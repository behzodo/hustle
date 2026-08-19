import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { Nango } from "@nangohq/node";

import { INTEGRATIONS, NANGO_SECRET_KEY } from "@/lib/nango";

/**
 * Texting, on the user's own Twilio account.
 *
 * The channel that actually reaches these businesses. Of seventy-three
 * Jacksonville shops the sweep built sites for, three had an email address
 * anywhere on the web and all seventy-three had a phone number, because a
 * phone number is what a Google listing is for. Everything in this file exists
 * because of that ratio.
 *
 * White-label in the only sense that matters: the account is theirs. They
 * connect it on our screen, we buy the number through their credentials, and
 * the number, the bill and the sending reputation belong to them. We never see
 * an Account SID or an Auth Token — Nango holds both, and this talks to Twilio
 * through Nango's proxy.
 *
 * One thing this cannot do anything about, and it has to be said on the
 * screen rather than discovered: texting a US number for business purposes
 * requires A2P 10DLC registration with the carriers. It is Twilio's form, it
 * takes a few days, and until it clears, carriers filter or reject the
 * traffic. Nothing here can shortcut that, and a product that pretends
 * otherwise produces a hundred texts that silently never arrive.
 */

const client = () => {
  if (!NANGO_SECRET_KEY) {
    throw new Error(
      "Texting is not configured. Set NANGO_SECRET_KEY, and connect a Twilio " +
        "account on the connections screen.",
    );
  }

  return new Nango({ secretKey: NANGO_SECRET_KEY });
};

/**
 * The Account SID, which is also the Twilio username.
 *
 * Every Twilio path contains it, and we deliberately do not store it — so it
 * is read back from Nango, which is holding it anyway as half of the basic-auth
 * pair. One extra call per operation, against never keeping a credential.
 */
const accountSid = async (connectionId: string): Promise<string> => {
  const nango = client();

  const connection = await nango.getConnection(INTEGRATIONS.twilio, connectionId);
  const credentials = connection.credentials as { username?: string };

  if (!credentials?.username) {
    throw new Error("That Twilio connection has no Account SID on it.");
  }

  return credentials.username;
};

/** Twilio speaks form-encoded, not JSON, on every write. */
const form = (fields: Record<string, string | undefined>) =>
  new URLSearchParams(
    Object.entries(fields).filter((entry): entry is [string, string] =>
      Boolean(entry[1]),
    ),
  ).toString();

const call = async <T>(
  connectionId: string,
  method: "GET" | "POST",
  path: string,
  body?: Record<string, string | undefined>,
): Promise<T> => {
  const nango = client();

  const res = await nango.proxy({
    method,
    endpoint: path,
    providerConfigKey: INTEGRATIONS.twilio,
    connectionId,
    ...(body
      ? {
          data: form(body),
          headers: { "content-type": "application/x-www-form-urlencoded" },
        }
      : {}),
  });

  return res.data as T;
};

/* -------------------------------------------------------------------------- *
 * Numbers.
 * -------------------------------------------------------------------------- */

export interface OwnedNumber {
  sid: string;
  number: string;
  friendly: string;
  /** Where Twilio currently posts inbound texts. Empty until we set it. */
  smsUrl?: string;
}

interface TwilioNumber {
  sid: string;
  phone_number: string;
  friendly_name: string;
  sms_url?: string;
  capabilities?: { sms?: boolean };
}

/** Numbers this account already owns that can send a text. */
export const listNumbers = async (connectionId: string): Promise<OwnedNumber[]> => {
  const sid = await accountSid(connectionId);

  const data = await call<{ incoming_phone_numbers?: TwilioNumber[] }>(
    connectionId,
    "GET",
    `/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json?PageSize=50`,
  );

  return (data.incoming_phone_numbers ?? [])
    .filter((n) => n.capabilities?.sms !== false)
    .map((n) => ({
      sid: n.sid,
      number: n.phone_number,
      friendly: n.friendly_name,
      smsUrl: n.sms_url || undefined,
    }));
};

export interface AvailableNumber {
  number: string;
  locality?: string;
  region?: string;
}

/**
 * Numbers that could be bought, near where the user works.
 *
 * Area code matters more than it looks. A local number is answered and a
 * toll-free one is ignored, and the whole premise of this product is a
 * freelancer in a town writing to businesses in the same town.
 */
export const searchNumbers = async (
  connectionId: string,
  { country = "US", areaCode }: { country?: string; areaCode?: string } = {},
): Promise<AvailableNumber[]> => {
  const sid = await accountSid(connectionId);

  const query = new URLSearchParams({ SmsEnabled: "true", PageSize: "10" });
  if (areaCode) query.set("AreaCode", areaCode);

  const data = await call<{
    available_phone_numbers?: {
      phone_number: string;
      locality?: string;
      region?: string;
    }[];
  }>(
    connectionId,
    "GET",
    `/2010-04-01/Accounts/${sid}/AvailablePhoneNumbers/${country}/Local.json?${query}`,
  );

  return (data.available_phone_numbers ?? []).map((n) => ({
    number: n.phone_number,
    locality: n.locality,
    region: n.region,
  }));
};

/**
 * Buys one, and points it at us in the same call.
 *
 * The webhook is set at purchase rather than afterwards on purpose: a number
 * bought without one is a number whose replies go nowhere, and the gap between
 * two calls is exactly long enough for the second to fail and leave the user
 * paying a dollar a month for a dead line.
 */
export const buyNumber = async (
  connectionId: string,
  number: string,
  inboundUrl: string,
): Promise<OwnedNumber> => {
  const sid = await accountSid(connectionId);

  const data = await call<TwilioNumber>(
    connectionId,
    "POST",
    `/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json`,
    { PhoneNumber: number, SmsUrl: inboundUrl, SmsMethod: "POST" },
  );

  return {
    sid: data.sid,
    number: data.phone_number,
    friendly: data.friendly_name,
    smsUrl: data.sms_url || undefined,
  };
};

/** Re-points an existing number at us, for one they already owned. */
export const pointNumberHere = async (
  connectionId: string,
  numberSid: string,
  inboundUrl: string,
): Promise<void> => {
  const sid = await accountSid(connectionId);

  await call(
    connectionId,
    "POST",
    `/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers/${numberSid}.json`,
    { SmsUrl: inboundUrl, SmsMethod: "POST" },
  );
};

/* -------------------------------------------------------------------------- *
 * Sending.
 * -------------------------------------------------------------------------- */

export interface SentText {
  /** Twilio's id for the message, which is also how a status callback finds it. */
  sid: string;
  status: string;
}

export const sendText = async (
  connectionId: string,
  { to, from, body }: { to: string; from: string; body: string },
): Promise<SentText> => {
  const sid = await accountSid(connectionId);

  const data = await call<{ sid?: string; status?: string; message?: string }>(
    connectionId,
    "POST",
    `/2010-04-01/Accounts/${sid}/Messages.json`,
    { To: to, From: from, Body: body },
  );

  if (!data?.sid) {
    throw new Error(`Twilio refused it: ${data?.message ?? JSON.stringify(data)}`);
  }

  return { sid: data.sid, status: data.status ?? "queued" };
};

/**
 * Turns whatever a Google listing printed into something Twilio will accept.
 *
 * "(904) 674-8588" is how a person writes a number and E.164 is the only thing
 * an API takes. Deliberately conservative: ten digits are assumed to be US
 * because that is where these sweeps run, eleven starting with a 1 are already
 * US with the country code, and anything else is handed back untouched with a
 * `+` if it has none — a wrong guess here texts a stranger in another country.
 */
export const toE164 = (raw: string, country = "1"): string | null => {
  const digits = raw.replace(/[^\d+]/g, "");

  if (digits.startsWith("+")) return digits.length >= 8 ? digits : null;

  const bare = digits.replace(/\D/g, "");

  if (bare.length === 10) return `+${country}${bare}`;
  if (bare.length === 11 && bare.startsWith("1")) return `+${bare}`;

  return null;
};

/* -------------------------------------------------------------------------- *
 * Inbound.
 * -------------------------------------------------------------------------- */

/**
 * Proves a webhook really came from Twilio.
 *
 * The inbound endpoint has to be public — Twilio posts to it from its own
 * servers with no shared secret — so without this, anybody who finds the URL
 * can forge a reply from any business and make the auto-answer write back to a
 * number of their choosing, from the user's account, at the user's expense.
 *
 * The signature is HMAC-SHA1 over the full URL with every POST field appended
 * in sorted order, keyed with the account's Auth Token. Compared in constant
 * time, because a byte-by-byte compare on a signature is a timing oracle.
 */
export const signatureValid = ({
  url,
  params,
  signature,
  authToken,
}: {
  url: string;
  params: Record<string, string>;
  signature: string;
  authToken: string;
}): boolean => {
  const payload = Object.keys(params)
    .sort()
    .reduce((out, key) => out + key + params[key], url);

  const expected = createHmac("sha1", authToken).update(payload, "utf8").digest("base64");

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);

  return a.length === b.length && timingSafeEqual(a, b);
};

/** The Auth Token, for verifying an inbound webhook. Never leaves the server. */
export const authTokenFor = async (connectionId: string): Promise<string> => {
  const nango = client();

  const connection = await nango.getConnection(INTEGRATIONS.twilio, connectionId);
  const credentials = connection.credentials as { password?: string };

  if (!credentials?.password) {
    throw new Error("That Twilio connection has no Auth Token on it.");
  }

  return credentials.password;
};
