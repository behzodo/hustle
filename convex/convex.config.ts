import { defineApp } from "convex/server";

// Credits started as a `Usage` table on rate-limiter-flexible, then moved to
// the @convex-dev/rate-limiter component when that library turned out to have
// no Convex store. The component has now gone too, and the reason is worth
// keeping: a rate limiter has a rate. There is nowhere in one to put a
// thousand credits somebody paid for that must not expire when the month
// rolls over, and the moment credits could be bought that became the whole
// requirement. The accounting lives in the `credits` and `creditLedger`
// tables now — see convex/credits.ts.
//
// Removing the component drops the counters it held. Nobody loses anything:
// a user with no row in the new table reads as a full allowance, which is at
// worst more generous than what they had.
const app = defineApp();

export default app;
