"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";

import { api } from "@/../convex/_generated/api";
import type { ProjectId } from "@/modules/projects/types";

/**
 * Reading a hustle's outreach from the browser.
 *
 * Live subscriptions, like the sweep's. It matters more here than anywhere
 * else in the product: a reply arrives days after the screen was opened, and a
 * pitch that changed from "sent" to "replied" while somebody had the inbox up
 * should say so without being asked to.
 *
 * The `"skip"` guards are the same auth-race fix as use-discovery.ts.
 */

/** Every pitch in this hustle, most recently touched first. */
export const usePitches = (projectId: ProjectId, limit?: number) => {
  const { isAuthenticated } = useConvexAuth();

  return useQuery(
    api.pitches.list,
    isAuthenticated ? { projectId, ...(limit === undefined ? {} : { limit }) } : "skip",
  );
};

/** The counts across the top: drafted, queued, sent, replied, unreachable. */
export const usePitchProgress = (projectId: ProjectId) => {
  const { isAuthenticated } = useConvexAuth();

  return useQuery(api.pitches.progress, isAuthenticated ? { projectId } : "skip");
};

export const useMarkPitchRead = () => useMutation(api.pitches.markRead);
export const useEditPitch = () => useMutation(api.pitches.editDraft);
export const useSetPitchStatus = () => useMutation(api.pitches.setStatus);
export const useSetLeadEmail = () => useMutation(api.pitches.setEmail);

/**
 * The other half of the patch: a site built, and nobody to send it to.
 *
 * Its own query rather than a flag on the pitch list, because these have no
 * pitch — there was nothing to address one to. On a real sweep this list is
 * the longer of the two by a wide margin.
 */
export const useUnreachable = (projectId: ProjectId) => {
  const { isAuthenticated } = useConvexAuth();

  return useQuery(api.pitches.unreachable, isAuthenticated ? { projectId } : "skip");
};
