"use client";

import { useConvexAuth, useQuery } from "convex/react";

import { api } from "@/../convex/_generated/api";
import type { ProjectId } from "@/modules/projects/types";

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

/**
 * One project, once the token is in place.
 *
 * `projects.get` goes through `requireOwnedProject`, so it throws
 * UNAUTHORIZED on that same first unauthenticated render rather than
 * returning null the way `profiles.status` and `credits.status` do.
 */
export const useProject = (projectId: ProjectId) => {
  const { isAuthenticated } = useConvexAuth();

  return useQuery(api.projects.get, isAuthenticated ? { projectId } : "skip");
};

/**
 * A project's messages, once the token is in place.
 *
 * Same reason again: `messages.list` proves ownership before it reads, so an
 * unguarded subscription throws before Convex has been handed the JWT — which
 * Next.js puts on screen as a runtime error overlay, ahead of the retry that
 * would have succeeded.
 */
export const useMessages = (projectId: ProjectId) => {
  const { isAuthenticated } = useConvexAuth();

  return useQuery(api.messages.list, isAuthenticated ? { projectId } : "skip");
};
