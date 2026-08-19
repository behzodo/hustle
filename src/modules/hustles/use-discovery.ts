"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";

import { api } from "@/../convex/_generated/api";
import type { ProjectId } from "@/modules/projects/types";

/**
 * Reading a hustle's sweep from the browser.
 *
 * Every one of these is a live subscription: a lead written by the sweep on
 * the server appears here without anything asking again. That is the whole
 * reason discovery runs in Convex rather than on Inngest — the screen watching
 * the hunt is watching the hunt, not a timer pretending to.
 *
 * The `"skip"` guards are the same auth-race fix as use-projects.ts: these
 * queries prove project ownership before they read, so an unguarded
 * subscription throws UNAUTHORIZED on the first render, before
 * ConvexProviderWithClerk has handed over the JWT.
 */

/** The latest sweep — running, finished, or failed. */
export const useHunt = (projectId: ProjectId) => {
  const { isAuthenticated } = useConvexAuth();

  return useQuery(api.discovery.status, isAuthenticated ? { projectId } : "skip");
};

/**
 * The working list: businesses with no site of their own, best first.
 *
 * `includeCovered` widens it to everything the sweep saw, the ones with a
 * website included — the denominator behind "41 of 260".
 */
export const useLeads = (
  /** Null when no hustle is picked — the businesses wall filters by chip. */
  projectId: ProjectId | null,
  { limit, includeCovered }: { limit?: number; includeCovered?: boolean } = {},
) => {
  const { isAuthenticated } = useConvexAuth();

  return useQuery(
    api.discovery.leads,
    isAuthenticated && projectId !== null
      ? {
          projectId,
          ...(limit === undefined ? {} : { limit }),
          ...(includeCovered === undefined ? {} : { includeCovered }),
        }
      : "skip",
  );
};

/** Every business found, hits and misses — what the map draws. */
export const usePins = (projectId: ProjectId) => {
  const { isAuthenticated } = useConvexAuth();

  return useQuery(api.discovery.pins, isAuthenticated ? { projectId } : "skip");
};

/** What a sweep will cost, before starting one. */
export const useHuntQuote = (projectId: ProjectId) => {
  const { isAuthenticated } = useConvexAuth();

  return useQuery(api.discovery.quote, isAuthenticated ? { projectId } : "skip");
};

export const useStartHunt = () => useMutation(api.discovery.start);
export const useStopHunt = () => useMutation(api.discovery.stop);

/** How far through the plan the sweep is, 0–1. */
export const huntProgress = (hunt: { cursor: number; queries: unknown[] } | null) =>
  hunt === null || hunt.queries.length === 0
    ? 0
    : Math.min(1, hunt.cursor / hunt.queries.length);

/**
 * The build queue, live.
 *
 * Same subscription model as the sweep above, and for the same reason: the
 * screen that watches a patch being built is watching the patch being built.
 * Every site the queue publishes patches a lead, and this re-renders.
 */
export const useBuildFeed = (projectId: ProjectId, take = 8) => {
  const { isAuthenticated } = useConvexAuth();

  return useQuery(api.sites.feed, isAuthenticated ? { projectId, take } : "skip");
};
