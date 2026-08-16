import { createTRPCRouter } from '../init';

// Projects, messages and credits now live in Convex — see convex/projects.ts,
// convex/messages.ts and convex/credits.ts. The router is kept as the mount
// point for anything that genuinely needs a Next.js server procedure later;
// nothing does today.
export const appRouter = createTRPCRouter({});
// export type definition of API
export type AppRouter = typeof appRouter;
