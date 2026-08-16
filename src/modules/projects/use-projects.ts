"use client";

import { useConvexAuth, useQuery } from "convex/react";

import { api } from "@/../convex/_generated/api";

/**
 * The caller's projects, or `undefined` while they aren't knowable yet.
 *
 * ConvexProviderWithClerk hands the JWT to Convex *after* the first render,
 * so a bare `useQuery(api.projects.list, {})` opens its subscription
 * unauthenticated and `requireUserId` throws UNAUTHORIZED — which Next.js
 * surfaces as a runtime error overlay before the retry ever lands. Skipping
 * until the token is in place removes the failed round trip entirely.
 *
 * `"skip"` yields `undefined`, the same value the query already returns while
 * loading, so every call site's existing loading branch covers this too.
 */
export const useProjects = () => {
  const { isAuthenticated } = useConvexAuth();

  return useQuery(api.projects.list, isAuthenticated ? {} : "skip");
};
