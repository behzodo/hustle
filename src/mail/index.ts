import "server-only";

import { readThread as readGmailThread, sendMail as sendGmail } from "@/pitch/gmail";

import { readThreadImap } from "./imap";
import { sendSmtp, verifySmtp } from "./smtp";
import { verifyImap } from "./imap";
import type { Incoming, Outgoing, Sent } from "./types";

export { stripQuoted } from "./quote";
export type { Incoming, Outgoing, Sent } from "./types";
export * as infraforge from "./infraforge";

/**
 * One door, two transports.
 *
 * Every user who has already connected a Google account is still sending
 * through it, and will be until they choose to move. A migration that required
 * them all to re-provision before anything worked would be a migration nobody
 * completed — so both live at once and the mailbox itself says which is which.
 *
 * Which also means this is not scaffolding to be deleted later. Some users
 * will want their own address on a pitch and should be allowed to have it; the
 * platform mailbox is the better default and the thing we sell, not the only
 * thing permitted.
 */

/**
 * Where a pitch is sent from.
 *
 * A discriminated union rather than a bag of optional fields, so a caller
 * cannot construct half a Gmail sender and half an Infraforge one and find out
 * at runtime. The credentials are never carried to a browser — see
 * convex/mailboxes.ts, where they live behind an internal query.
 */
export type Sender =
  | { kind: "gmail"; email: string; connectionId: string }
  | {
      kind: "infraforge";
      email: string;
      /** Display name on the From header. A person's name, not a company's. */
      name?: string;
      user: string;
      password: string;
      smtpHost?: string;
      smtpPort?: number;
      imapHost?: string;
      imapPort?: number;
    };

/** Sends one email, whichever way this mailbox sends. */
export const sendVia = async (sender: Sender, message: Outgoing): Promise<Sent> => {
  if (sender.kind === "gmail") {
    return await sendGmail(sender.connectionId, message);
  }

  return await sendSmtp(sender, {
    ...message,
    // The stored display name wins over whatever the caller guessed, because
    // it is the name the mailbox was provisioned under and therefore the one
    // the recipient will see on every other message from it.
    from: { ...message.from, name: message.from.name ?? sender.name },
  });
};

/** Reads a conversation back, whichever way this mailbox reads. */
export const readVia = async (
  sender: Sender,
  threadId: string,
): Promise<Incoming[]> => {
  if (sender.kind === "gmail") {
    return await readGmailThread(sender.connectionId, threadId, sender.email);
  }

  return await readThreadImap(sender, threadId, sender.email);
};

/**
 * Proves a mailbox works, both ways, before anything is queued to it.
 *
 * Both directions rather than just sending, because a mailbox that sends and
 * cannot be read is worse than one that does neither: the pitches go out, the
 * replies arrive, and nothing ever notices them. That failure is silent for
 * exactly as long as it takes somebody to wonder why nobody is answering.
 */
export const verifySender = async (
  sender: Sender,
): Promise<{ send: boolean; read: boolean; error?: string }> => {
  if (sender.kind === "gmail") {
    // Nango holds the token and refreshes it; there is nothing here to check
    // that the connections screen does not already show.
    return { send: true, read: true };
  }

  try {
    await verifySmtp(sender);
  } catch (cause) {
    return { send: false, read: false, error: String(cause) };
  }

  try {
    await verifyImap(sender);
  } catch (cause) {
    return { send: true, read: false, error: String(cause) };
  }

  return { send: true, read: true };
};
