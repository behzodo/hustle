/**
 * The shapes both transports have to speak.
 *
 * Lifted out of src/pitch/gmail.ts unchanged rather than redesigned. They were
 * already the right shape — the pitch queue was written against them and never
 * needed to know what was underneath — and keeping them identical is what
 * makes Infraforge a transport swap instead of a rewrite of everything that
 * sends or reads.
 *
 * The one thing worth restating is what `threadId` now means. On Gmail it was
 * Google's own id for a conversation. On SMTP there is no such thing, so it is
 * the RFC 2822 Message-ID of the first email in the conversation, which
 * every later message in that conversation carries in its References header.
 * Same job, same field, and nothing above this layer can tell the difference.
 */

export interface Outgoing {
  to: string;
  subject: string;
  body: string;
  /** Who it comes from. */
  from: { email: string; name?: string };
  /** Set to reply into an existing conversation. */
  replyTo?: { threadId: string; rfcId?: string };
}

export interface Sent {
  /** The transport's id for the message. */
  messageId: string;
  /** The conversation it belongs to. */
  threadId: string;
  /** The RFC 2822 Message-ID, which is what a reply threads onto. */
  rfcId?: string;
}

export interface Incoming {
  messageId: string;
  from: string;
  at: number;
  text: string;
  /** False for the copies of our own sent messages that live in the thread. */
  theirs: boolean;
}
