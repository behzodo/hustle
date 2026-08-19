import { cronJobs } from "convex/server";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

/**
 * The minute hand.
 *
 * A text is answered by its webhook the instant it arrives — Twilio posts to
 * us, and the whole loop takes about four seconds. Email has no equivalent
 * without a Google Cloud project and a Pub/Sub topic, so it is polled instead,
 * once a minute. From the business's side that is the same thing: they send a
 * reply, and an answer arrives while they are still on the page.
 *
 * The work itself is not done here. Reading a Gmail thread means going through
 * Nango, and writing a reply means the free-tier model stack — both of which
 * live in the Next app, not in Convex. So this is a heartbeat that knocks on
 * the app's door, and the app does the reading.
 */
const crons = cronJobs();

/**
 * Where to knock.
 *
 * Set with `npx convex env set APP_TICK_URL https://…`. Absent means the
 * heartbeat does nothing at all, which is the right behaviour on a deployment
 * with no app in front of it — and on a laptop, where the URL would point at a
 * localhost the Convex cloud cannot reach.
 */
export const tick = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const url = process.env.APP_TICK_URL;
    const secret = process.env.AGENT_WEBHOOK_SECRET;

    if (!url || !secret) return null;

    const mailboxes = await ctx.runQuery(internal.pitches.openMailboxes, {});

    if (mailboxes.length === 0) return null;

    try {
      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({ mailboxes }),
      });
    } catch (cause) {
      // A missed minute is a reply seen sixty seconds later. Not worth a
      // failed cron run and the retry storm that follows one.
      console.error("[pitch] heartbeat could not reach the app:", cause);
    }

    return null;
  },
});

crons.interval("answer replies", { seconds: 60 }, internal.crons.tick, {});

export default crons;
