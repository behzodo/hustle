import "server-only";

import { Nango } from "@nangohq/node";

import { GMAIL_INTEGRATION_ID, NANGO_SECRET_KEY } from "@/lib/nango";

/**
 * Sending from the user's own Gmail, and reading what comes back.
 *
 * Their account rather than ours, and that is the whole design. A pitch is a
 * message from a freelancer to a business owner in their town; sent from a
 * shared platform address it is a mailshot, sent from their own address it is
 * an email. It also means the reply lands where they will see it, and that
 * their sending reputation is theirs — which is the fair way round, since it
 * is their name on the bottom of it.
 *
 * Nango holds the OAuth tokens and refreshes them. Nothing here ever sees a
 * Google credential; it sees a connection id, which is useless on its own.
 */

/** Gmail's own name for the mailbox of whoever authorised the connection. */
const ME = "/gmail/v1/users/me";

const client = () => {
  if (!NANGO_SECRET_KEY) {
    throw new Error(
      "Gmail is not configured. Set NANGO_SECRET_KEY, and connect a Google " +
        "account on the connections screen.",
    );
  }

  return new Nango({ secretKey: NANGO_SECRET_KEY });
};

/**
 * base64url, which is not base64.
 *
 * Gmail rejects a normal base64 payload: `+` and `/` are not valid in the
 * field it goes in, and the padding confuses its parser. Three replacements,
 * and the difference between a message that sends and a 400 that says
 * "Invalid value" and nothing else.
 */
const urlSafe = (buffer: Buffer) =>
  buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/**
 * RFC 2047, for headers that are not plain ASCII.
 *
 * A subject line containing a business's name — a café, a jalapeño, an
 * apostrophe some fonts render as U+2019 — is not ASCII, and a raw UTF-8 byte
 * in a header is undefined behaviour that different mail clients resolve
 * differently. Encoded only when it has to be, because an encoded-word in a
 * subject is very slightly worse for deliverability than a plain one.
 */
const header = (value: string) =>
  /^[\x00-\x7F]*$/.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;

export interface Outgoing {
  to: string;
  subject: string;
  body: string;
  /** Who it comes from, as Gmail knows them. */
  from: { email: string; name?: string };
  /**
   * Set to reply into an existing conversation.
   *
   * Both are needed and they do different jobs: `threadId` is what Gmail uses
   * to file it, and `rfcId` is what every other mail client uses — a reply
   * with only the first shows as threaded to the sender and as a new cold
   * email to the recipient, which is exactly backwards.
   */
  replyTo?: { threadId: string; rfcId?: string };
}

/**
 * The message itself, as the wire wants it.
 *
 * Plain text, deliberately. An HTML pitch with a tracking pixel and a styled
 * button is a marketing email and is filtered as one; this is meant to read
 * like something a person typed, and the surest way to achieve that is for it
 * to be something a person could have typed.
 */
const compose = ({ to, subject, body, from, replyTo }: Outgoing) => {
  const lines = [
    `From: ${from.name ? `${header(from.name)} <${from.email}>` : from.email}`,
    `To: ${to}`,
    `Subject: ${header(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
  ];

  if (replyTo?.rfcId) {
    lines.push(`In-Reply-To: ${replyTo.rfcId}`, `References: ${replyTo.rfcId}`);
  }

  // Base64 body, wrapped at 76 characters as the MIME spec requires. Chosen
  // over 8-bit because a body containing a long URL and an em dash is exactly
  // the shape that gets mangled by a relay somewhere between here and them.
  const encoded = Buffer.from(body, "utf8")
    .toString("base64")
    .replace(/(.{76})/g, "$1\r\n");

  return `${lines.join("\r\n")}\r\n\r\n${encoded}`;
};

export interface Sent {
  /** Gmail's id for the message. */
  messageId: string;
  /** Gmail's id for the conversation it belongs to. */
  threadId: string;
  /** The RFC 2822 Message-ID, which is what a reply threads onto. */
  rfcId?: string;
}

/**
 * Sends one email.
 *
 * Throws on refusal rather than returning a failure, because every caller has
 * a row to mark failed and a reason to store in it, and a silent false would
 * leave a pitch that looks sent and is not.
 */
export const sendMail = async (
  connectionId: string,
  message: Outgoing,
): Promise<Sent> => {
  const nango = client();

  const res = await nango.proxy({
    method: "POST",
    endpoint: `${ME}/messages/send`,
    providerConfigKey: GMAIL_INTEGRATION_ID,
    connectionId,
    data: {
      raw: urlSafe(Buffer.from(compose(message), "utf8")),
      ...(message.replyTo ? { threadId: message.replyTo.threadId } : {}),
    },
  });

  const data = res.data as { id?: string; threadId?: string };

  if (!data?.id || !data?.threadId) {
    throw new Error(`Gmail accepted nothing back: ${JSON.stringify(res.data)}`);
  }

  // The Message-ID is assigned by Gmail on send and is not in the send
  // response, so it costs one more call to learn. Worth it: without it every
  // follow-up arrives in the recipient's inbox as a separate email.
  let rfcId: string | undefined;

  try {
    const full = await nango.proxy({
      method: "GET",
      endpoint: `${ME}/messages/${data.id}`,
      providerConfigKey: GMAIL_INTEGRATION_ID,
      connectionId,
      params: { format: "metadata", metadataHeaders: "Message-ID" },
    });

    rfcId = headerValue(full.data, "message-id");
  } catch {
    // Not fatal. The email has been sent; this only costs threading on a
    // follow-up that may never be written.
  }

  return { messageId: data.id, threadId: data.threadId, rfcId };
};

interface GmailHeader {
  name?: string;
  value?: string;
}

interface GmailPart {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
}

interface GmailMessage extends GmailPart {
  id?: string;
  threadId?: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: GmailPart & { headers?: GmailHeader[] };
}

const headerValue = (message: unknown, name: string): string | undefined => {
  const headers = (message as GmailMessage)?.payload?.headers ?? [];

  return headers.find((h) => h.name?.toLowerCase() === name)?.value;
};

/**
 * Digs the readable text out of a Gmail message.
 *
 * A message is a tree, not a string. A reply from a phone is typically
 * `multipart/alternative` holding a plain part and an HTML part; a reply with
 * a photo attached wraps that again in `multipart/mixed`. Depth-first for the
 * plain part, and only if there is none does it fall back to stripping tags
 * out of the HTML one.
 */
const textOf = (part: GmailPart | undefined): string => {
  if (!part) return "";

  const decode = (data?: string) =>
    data ? Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8") : "";

  if (part.mimeType === "text/plain" && part.body?.data) return decode(part.body.data);

  for (const child of part.parts ?? []) {
    const found = textOf(child);
    if (found) return found;
  }

  if (part.mimeType === "text/html" && part.body?.data) {
    return decode(part.body.data)
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  return "";
};

/**
 * Everything below this line is the email being replied to, not the reply.
 *
 * Every client quotes differently and none of them agree, so this matches the
 * three shapes that cover almost all of it: Gmail's "On <date> <name> wrote:",
 * a run of `>` quoting, and Outlook's horizontal rule of underscores. What is
 * left is what the person actually typed, which is the only part worth showing
 * or classifying.
 */
export const stripQuoted = (text: string) => {
  const cut = text.search(
    /^\s*(?:On .{5,120}wrote:|-{2,}\s*Original Message|_{5,}|From:\s.+<)/m,
  );

  const body = cut === -1 ? text : text.slice(0, cut);

  return body
    .split("\n")
    .filter((line) => !/^\s*>/.test(line))
    .join("\n")
    .trim();
};

export interface Incoming {
  messageId: string;
  from: string;
  at: number;
  text: string;
  /** False for the copies of our own sent messages that live in the thread. */
  theirs: boolean;
}

/**
 * Reads a conversation back.
 *
 * Returns every message in it, ours included, because "did they reply" is
 * answered by comparing the two — a thread of one message is a pitch nobody
 * has answered, and knowing which is which needs both.
 */
export const readThread = async (
  connectionId: string,
  threadId: string,
  us: string,
): Promise<Incoming[]> => {
  const nango = client();

  const res = await nango.proxy({
    method: "GET",
    endpoint: `${ME}/threads/${threadId}`,
    providerConfigKey: GMAIL_INTEGRATION_ID,
    connectionId,
    params: { format: "full" },
  });

  const messages = ((res.data as { messages?: GmailMessage[] })?.messages ?? []).filter(
    (m): m is GmailMessage => Boolean(m?.id),
  );

  return messages.map((message) => {
    const from = headerValue(message, "from") ?? "";

    return {
      messageId: message.id!,
      from,
      at: Number(message.internalDate ?? 0),
      text: stripQuoted(textOf(message.payload)),
      // Matched on the address inside the angle brackets rather than on the
      // whole header, which carries a display name that may be anything.
      theirs: !from.toLowerCase().includes(us.toLowerCase()),
    };
  });
};
