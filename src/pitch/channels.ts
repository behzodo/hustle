import "server-only";

import type { PitchChannel } from "./write";

/**
 * Which way to reach one business.
 *
 * The order is not a preference, it is a measurement. Of seventy-three
 * Jacksonville businesses the sweep built sites for, three had an email
 * address findable anywhere and seventy-three had a phone number — because a
 * phone number is what a Google listing exists to carry and an email address
 * is a field it does not have.
 *
 * Email still goes first where there is one. It costs nothing to send, it
 * carries a link that is clickable rather than retyped, and a website pitched
 * by email reads as a proposal where the same words by text read as a cold
 * call. But for nineteen businesses in twenty there is no email, and the
 * choice is a text or nothing.
 *
 * Instagram and Facebook are absent on purpose. Meta refuses a message to
 * anybody who has not written in first, so neither can ever be the channel a
 * pitch starts on — they only receive. See CAN_START in src/lib/nango.ts.
 */

export interface Reachable {
  email?: string;
  phone?: string;
}

export interface Sender {
  /** Set when a Gmail account is connected. */
  canEmail: boolean;
  /** Set when Twilio is connected *and* a number has been bought. */
  canText: boolean;
}

export interface Route {
  channel: PitchChannel;
  to: string;
}

/**
 * Picks the channel, or says why there is none.
 *
 * Returns null rather than throwing for a business that cannot be reached at
 * all, because on a real patch that is most of them and it is an outcome
 * rather than an error — one the screen has to show as a worklist.
 */
export const routeFor = (lead: Reachable, sender: Sender): Route | null => {
  if (lead.email && sender.canEmail) return { channel: "email", to: lead.email };
  if (lead.phone && sender.canText) return { channel: "sms", to: lead.phone };

  return null;
};

/** Why a business could not be reached, in words for the screen. */
export const whyUnreachable = (lead: Reachable, sender: Sender): string => {
  if (lead.email && !sender.canEmail) return "Connect Gmail to email this one";
  if (lead.phone && !sender.canText) {
    return "Has a phone but no email — connect texting to reach them";
  }

  return "No email and no phone on the listing";
};
