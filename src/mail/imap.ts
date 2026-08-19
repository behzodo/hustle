import "server-only";

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

import { stripQuoted } from "./quote";
import type { Incoming } from "./types";

/**
 * Reading replies, without a conversation to ask for.
 *
 * Gmail had threads. You asked for one by id and got every message in it,
 * ordered, ours and theirs together. IMAP has no such call — it has folders
 * full of individual messages and a search — so the conversation has to be
 * reassembled from the headers that define one.
 *
 * Which is what a mail client does, and the rule is the same everywhere: a
 * message belongs to a conversation if its `References` or `In-Reply-To`
 * carries the Message-ID that started it. smtp.ts generates and stores that id
 * as the thread root, so it is known before any reply exists to be found.
 *
 * Two folders rather than one. The sent copies are ours and live in Sent; the
 * replies are theirs and live in INBOX; and `checkReplies` in
 * src/pitch-queue.ts decides whether anything has happened by comparing the
 * message count against what it saw last time. Read only the inbox and every
 * conversation looks one message shorter than it is, which reads as a reply
 * that has not arrived.
 */

export interface ImapCredentials {
  user: string;
  password: string;
  imapHost?: string;
  imapPort?: number;
}

const connect = async (credentials: ImapCredentials) => {
  if (!credentials.imapHost) {
    throw new Error(
      `No IMAP host stored for ${credentials.user}. Re-fetch its credentials from Infraforge.`,
    );
  }

  const client = new ImapFlow({
    host: credentials.imapHost,
    port: credentials.imapPort ?? 993,
    secure: (credentials.imapPort ?? 993) === 993,
    auth: { user: credentials.user, pass: credentials.password },
    // Off. imapflow's logger writes every command to stdout at info level,
    // and those commands include the LOGIN line — which is a mailbox password
    // in the application logs, on every poll, once a minute.
    logger: false,
  });

  await client.connect();
  return client;
};

/**
 * Where sent mail lives on this server.
 *
 * Asked for rather than assumed. "Sent", "Sent Items", "INBOX.Sent" and
 * "[Gmail]/Sent Mail" are all real answers depending on who is serving, and a
 * hardcoded guess fails as an empty folder rather than as an error — so the
 * bug would present as "they never replied" rather than as anything findable.
 */
const sentFolder = async (client: ImapFlow): Promise<string | null> => {
  try {
    for (const box of await client.list()) {
      if (box.specialUse === "\\Sent") return box.path;
    }

    for (const box of await client.list()) {
      if (/^(?:INBOX[./])?sent(?:[ -]?items|[ -]?mail)?$/i.test(box.path)) {
        return box.path;
      }
    }
  } catch {
    // A server that will not list is a server we read the inbox of and no
    // more. Better than failing the whole poll.
  }

  return null;
};

/** The addresses in a From header, lowercased, without the display names. */
const addressesIn = (from: string) =>
  (from.match(/[\w.+-]+@[\w.-]+\.\w+/g) ?? []).map((address) => address.toLowerCase());

/**
 * The readable text of a message, whichever part carries it.
 *
 * mailparser fills `text` from the text/plain part and types `html` as
 * `string | false` — false meaning there was no HTML part at all, which is not
 * the same as an empty one. A reply typed on a phone is usually both; a reply
 * from a mail client somebody's nephew set up is sometimes only HTML, and
 * classifying an empty string as a verdict is how a "yes please" becomes a
 * pitch that looks unanswered.
 */
const plainFrom = (parsed: { text?: string; html?: string | false }) => {
  if (parsed.text?.trim()) return parsed.text;
  if (typeof parsed.html !== "string") return "";

  return parsed.html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(?:p|div|br|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
};

/**
 * Every message in one conversation, oldest first.
 *
 * The search is by header rather than by body or subject, because a subject is
 * edited by the person replying and a body is quoted into the next message.
 * References is the only field that is machine-maintained and reliably
 * survives a round trip through whatever mail client a plumber uses.
 */
const searchThread = async (
  client: ImapFlow,
  folder: string,
  root: string,
): Promise<Incoming[]> => {
  const lock = await client.getMailboxLock(folder);

  try {
    // The root message itself is matched by its own Message-ID; everything
    // that answers it is matched by carrying that id in one of the two
    // threading headers. Some clients set only In-Reply-To, so both are asked.
    const uids = await client.search(
      {
        or: [
          { header: { "message-id": root } },
          { header: { references: root } },
          { header: { "in-reply-to": root } },
        ],
      },
      { uid: true },
    );

    if (!uids || uids.length === 0) return [];

    const found: Incoming[] = [];

    for await (const message of client.fetch(
      uids,
      { uid: true, source: true },
      { uid: true },
    )) {
      if (!message.source) continue;

      const parsed = await simpleParser(message.source);

      found.push({
        messageId: parsed.messageId ?? `uid:${message.uid}`,
        from: parsed.from?.text ?? "",
        at: (parsed.date ?? new Date(0)).getTime(),
        text: stripQuoted(plainFrom(parsed)),
        // Overwritten by the caller, which is the only place that knows our
        // own address.
        theirs: true,
      });
    }

    return found;
  } finally {
    lock.release();
  }
};

/**
 * Reads a conversation back.
 *
 * Returns every message in it, ours included, because "did they reply" is
 * answered by comparing the two — a thread of one message is a pitch nobody
 * has answered, and knowing which is which needs both.
 *
 * Same signature and same return shape as the Gmail version it replaces, so
 * src/pitch-queue.ts does not change.
 */
export const readThreadImap = async (
  credentials: ImapCredentials,
  threadId: string,
  us: string,
): Promise<Incoming[]> => {
  const client = await connect(credentials);

  try {
    const folders = ["INBOX", await sentFolder(client)].filter(
      (folder): folder is string => Boolean(folder),
    );

    const collected: Incoming[] = [];

    for (const folder of folders) {
      collected.push(...(await searchThread(client, folder, threadId)));
    }

    const ours = us.toLowerCase();

    return (
      collected
        // One message can be in both folders — a server that copies a sent
        // message into the inbox, or a self-addressed test — and the count is
        // what decides whether anything new has arrived, so a duplicate reads
        // as a reply.
        .filter(
          (message, index, all) =>
            all.findIndex((other) => other.messageId === message.messageId) === index,
        )
        .map((message) => ({
          ...message,
          // Matched on the address inside the angle brackets rather than on the
          // whole header, which carries a display name that may be anything —
          // including, on a reply, our own name quoted back at us.
          theirs: !addressesIn(message.from).includes(ours),
        }))
        .sort((a, b) => a.at - b.at)
    );
  } finally {
    // Always. An IMAP connection left open holds a session on the server, and
    // these servers cap concurrent sessions per mailbox — so a leak here shows
    // up later as a poll that cannot log in.
    await client.logout().catch(() => client.close());
  }
};

/** Proves a mailbox can be read before the reply loop depends on it. */
export const verifyImap = async (credentials: ImapCredentials): Promise<true> => {
  const client = await connect(credentials);

  try {
    const lock = await client.getMailboxLock("INBOX");
    lock.release();
    return true;
  } finally {
    await client.logout().catch(() => client.close());
  }
};
