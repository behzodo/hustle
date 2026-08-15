import { defineApp } from "convex/server";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";

// Credits used to be a `Usage` table driven by rate-limiter-flexible's Prisma
// store. That library has no Convex adapter, so the component owns the
// accounting now — see convex/credits.ts.
const app = defineApp();
app.use(rateLimiter);

export default app;
