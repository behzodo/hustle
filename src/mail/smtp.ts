import "server-only";

import nodemailer from "nodemailer";

import type { Outgoing, Sent } from "./types";

/**
 * Sending, without a vendor API in the way.
 *
 * Gmail gave us two ids for free — one for the message, one for the
 * conversation — and SMTP gives neither. It is a protocol for handing a
 * message to a server, and what comes back is an acknowledgement, not a
 * record. There is no thread, because threading is not a mail server concept
 * at all: it is something clients reconstruct from headers afterwards.
 *
 * So the Message-ID is generated here, before the send, rather than read off a
 * response afterwards. That single change is what keeps the rest of the
 * codebase intact. `pitches.gmail.threadId` goes on meaning "the conversation
 * this belongs to" — it just holds the Message-ID of the first email in it
 * instead of Google's id for the same thing, and imap.ts finds the rest of the
 * conversation by looking for that value in everything else's References. No
 * migration, no second column, and the reply loop in src/pitch-queue.ts does
 * not know anything changed.
 */

/**
 * A Message-ID, which has to be globally unique and look like an address.
 *
 * The domain half must be the sending domain. A Message-ID whose right-hand
 * side does not match the envelope is a small, specific signal of forgery, and
 * spam filters are built out of exactly these.
 */
const messageId = (from: string) => {
  const domain = from.split("@")[1] ?? "localhost";
  const unique = `${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 12)}`;

  return `<${unique}@${domain}>`;
};

export interface SmtpCredentials {
  user: string;
  password: string;
  smtpHost?: string;
  smtpPort?: number;
}

/**
 * One connection per message, opened and closed.
 *
 * A pool would be the obvious choice and is the wrong one here. The send queue
 * deliberately waits forty seconds between messages — see SEND_GAP_MS — which
 * is long enough for an idle SMTP connection to be dropped by the server, and
 * a pooled transport hands you that dead socket rather than a fresh one. The
 * cost of reconnecting is a few hundred milliseconds inside a forty-second
 * gap, which is to say no cost at all.
 */
const transportFor = (credentials: SmtpCredentials) => {
  if (!credentials.smtpHost) {
    throw new Error(
      `No SMTP host stored for ${credentials.user}. Re-fetch its credentials from Infraforge.`,
    );
  }

  const port = credentials.smtpPort ?? 465;

  return nodemailer.createTransport({
    host: credentials.smtpHost,
    port,
    // 465 is implicit TLS; 587 opens plain and upgrades with STARTTLS. Getting
    // this backwards produces a connection that hangs rather than one that
    // fails, which is a much worse way to find out.
    secure: port === 465,
    auth: { user: credentials.user, pass: credentials.password },
    // A mail server that has not answered in twenty seconds is not going to.
    // Without this the default is two minutes, and a send loop stuck on one
    // dead mailbox blocks every pitch behind it.
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 30_000,
  });
};

/**
 * Sends one email.
 *
 * Plain text only, and that is a deliberate carry-over rather than a
 * simplification. An HTML body with a tracking pixel and a styled button is a
 * marketing email and is filtered as one; this is meant to read like something
 * a person typed, and the surest way to achieve that is for it to be something
 * a person could have typed.
 *
 * Throws on refusal rather than returning a failure, because every caller has
 * a row to mark failed and a reason to store in it, and a silent false would
 * leave a pitch that looks sent and is not.
 */
export const sendSmtp = async (
  credentials: SmtpCredentials,
  message: Outgoing,
): Promise<Sent> => {
  const transport = transportFor(credentials);

  // Ours, not the server's. Known before the send so it can be stored even if
  // the acknowledgement is lost on the way back.
  const rfcId = messageId(message.from.email);

  try {
    await transport.sendMail({
      messageId: rfcId,
      from: message.from.name
        ? { name: message.from.name, address: message.from.email }
        : message.from.email,
      to: message.to,
      subject: message.subject,
      text: message.body,
      ...(message.replyTo?.rfcId
        ? {
            // Both, and they do different jobs. `In-Reply-To` names the one
            // message this answers; `References` carries the whole chain and is
            // what most clients actually thread on. A reply with only the first
            // shows as threaded to some recipients and as a new cold email to
            // others.
            inReplyTo: message.replyTo.rfcId,
            references: [message.replyTo.threadId, message.replyTo.rfcId]
              .filter((id, index, all) => id && all.indexOf(id) === index)
              .join(" "),
          }
        : {}),
    });
  } finally {
    // Always, including after a throw. A transport that is never closed keeps
    // its socket and its timers, and a send loop that fails on every message
    // would otherwise leak one of each per attempt.
    transport.close();
  }

  return {
    messageId: rfcId,
    // A reply stays in the conversation it answers; a first email starts one,
    // and is its own root.
    threadId: message.replyTo?.threadId ?? rfcId,
    rfcId,
  };
};

/**
 * Proves a mailbox can actually send before it is offered as one that can.
 *
 * Worth its own call because provisioning is asynchronous — a mailbox comes
 * back from Infraforge before its DNS has finished propagating — and the
 * alternative to checking is discovering it inside the send loop, one pitch at
 * a time, against real businesses.
 */
export const verifySmtp = async (credentials: SmtpCredentials): Promise<true> => {
  const transport = transportFor(credentials);

  try {
    await transport.verify();
    return true;
  } finally {
    transport.close();
  }
};
