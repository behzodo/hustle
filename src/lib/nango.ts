// Nango holds every third-party credential and refreshes the ones that expire;
// the app only ever keeps a connection id. Nothing here removes the need for
// our own OAuth clients — Nango runs the flow, the provider still reviews the
// app.

/**
 * The accounts a user can connect, keyed by Nango's own provider id.
 *
 * All four go through one flow and one screen. That is the point of routing
 * everything through Nango rather than holding a Twilio token in our database
 * and a Google refresh token beside it: adding a channel becomes a logo and
 * two strings, and no secret belonging to a user is ever stored by us.
 */
export const INTEGRATIONS = {
  /** Sends the pitch and receives the reply, from the user's own address. */
  gmail: "google-mail",
  /**
   * Texting, on the user's own Twilio account.
   *
   * White-label by construction: they connect their account through our
   * screen, we buy the number on it through their credentials, and the bill,
   * the number and the sending reputation are all theirs. Nango's Twilio
   * provider is BASIC auth, so what they paste is an Account SID and an Auth
   * Token — no OAuth app of ours in the middle.
   */
  twilio: "twilio",
  /** Reads and answers Instagram DMs. See the note on cold DMs below. */
  instagram: "instagram",
  /** The same for a Facebook Page's inbox. */
  facebook: "facebook",
} as const;

export type IntegrationKey = keyof typeof INTEGRATIONS;

/**
 * What each connection may actually be used for.
 *
 * `cold` is the one that matters and it is not a preference, it is policy.
 * Meta's messaging APIs do not permit a business to open a conversation with
 * somebody who has not messaged it first — Instagram and Facebook can only
 * reply, and only inside the window that opens when a person writes in. Any
 * attempt to cold-DM a business through the Graph API is refused at the API,
 * not merely frowned upon.
 *
 * So the two social connections are inbound channels. They exist so a reply
 * from a business that found the site and messaged on Instagram lands in the
 * same inbox as everything else, and can be answered from it. Email and SMS
 * are the only two channels that may start a conversation.
 */
export const CAN_START: Record<IntegrationKey, boolean> = {
  gmail: true,
  twilio: true,
  instagram: false,
  facebook: false,
};

/** Nango's provider key for Gmail. Kept for the code written before the map. */
export const GMAIL_INTEGRATION_ID = INTEGRATIONS.gmail;

export const NANGO_SECRET_KEY = process.env.NANGO_SECRET_KEY;

/** Configured only once the Nango keys are present in the environment. */
export const isNangoConfigured = () => Boolean(NANGO_SECRET_KEY);

/** Whether a string names a connection this app is willing to open. */
export const isIntegrationKey = (value: string): value is IntegrationKey =>
  Object.prototype.hasOwnProperty.call(INTEGRATIONS, value);
