import { auth } from "@clerk/nextjs/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";

import { api } from "@/../convex/_generated/api";
import { buyNumber, listNumbers, pointNumberHere, searchNumbers } from "@/pitch/twilio";

/**
 * Getting the user a number to text from.
 *
 * This is the "buy it from inside our app" half of the white label. They
 * connect their own Twilio on the connections screen and then never see
 * Twilio's console again: we list what they own, search what is free near
 * them, buy one on their account, and point it back at us so replies arrive.
 *
 * Their account means their bill — about a dollar a month for the number and
 * under a cent a text — and their sending reputation, which is the right way
 * round given it is their name on the message.
 */

/** Where Twilio posts an inbound text. Public, and signature-checked there. */
const inboundUrl = () => {
  const origin = process.env.NEXT_PUBLIC_APP_URL;

  if (!origin) throw new Error("NEXT_PUBLIC_APP_URL is not set.");

  return `${origin.replace(/\/$/, "")}/api/twilio/inbound`;
};

const profileFor = async (token: string) =>
  await fetchQuery(api.profiles.status, {}, { token });

export async function GET(request: Request) {
  const { userId, getToken } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const token = await getToken({ template: "convex" });
  if (!token) return new Response("Unauthorized", { status: 401 });

  const profile = await profileFor(token);

  if (!profile?.twilioConnectionId) {
    return Response.json({ error: "Connect Twilio first." }, { status: 409 });
  }

  const areaCode =
    new URL(request.url).searchParams.get("areaCode")?.replace(/\D/g, "") || undefined;

  try {
    // Both at once: what they have, and what they could have. The screen shows
    // one or the other and asking twice would double the wait for no reason.
    const [owned, available] = await Promise.all([
      listNumbers(profile.twilioConnectionId),
      searchNumbers(profile.twilioConnectionId, { areaCode }).catch(() => []),
    ]);

    return Response.json({ owned, available });
  } catch (cause) {
    return Response.json({ error: String(cause) }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const { userId, getToken } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const token = await getToken({ template: "convex" });
  if (!token) return new Response("Unauthorized", { status: 401 });

  const profile = await profileFor(token);

  if (!profile?.twilioConnectionId) {
    return Response.json({ error: "Connect Twilio first." }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const number = String(body?.number ?? "").trim();
  const sid = String(body?.sid ?? "").trim();

  if (!number) {
    return Response.json({ error: "Which number?" }, { status: 400 });
  }

  try {
    // A number they already own is re-pointed rather than bought again —
    // buying a second line for somebody who has one is spending their money to
    // solve a problem they do not have.
    const owned = sid
      ? (await pointNumberHere(profile.twilioConnectionId, sid, inboundUrl()),
        { sid, number })
      : await buyNumber(profile.twilioConnectionId, number, inboundUrl());

    await fetchMutation(
      api.profiles.setConnections,
      { twilioNumber: owned.number, twilioNumberSid: owned.sid },
      { token },
    );

    return Response.json({ number: owned.number, sid: owned.sid });
  } catch (cause) {
    return Response.json({ error: String(cause) }, { status: 502 });
  }
}
