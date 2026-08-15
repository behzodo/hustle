import { ConvexError } from "convex/values";

import type { QueryCtx, MutationCtx } from "../_generated/server";

/**
 * The Clerk user id for the caller, or a thrown error.
 *
 * This replaces `ctx.auth.userId` from the tRPC `protectedProcedure`. Auth
 * lives at the function boundary now: every mutation and every query that
 * returns private data calls this first, so there is no way to reach a row
 * without having proved who you are.
 *
 * `identity.subject` is Clerk's user id — the same value that was written
 * into `Project.userId` and `Profile.userId` under Prisma, so existing rows
 * keep matching after the data is copied over.
 */
export async function requireUserId(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();

  if (identity === null) {
    throw new ConvexError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }

  return identity.subject;
}

/**
 * Loads a project and proves the caller owns it.
 *
 * Ownership was previously enforced by putting `userId` in the Prisma
 * `where` clause. Convex looks documents up by id, so the check has to be
 * explicit — and it has to be everywhere, or a stray project id from one
 * account reads another account's build.
 */
export async function requireOwnedProject(
  ctx: QueryCtx | MutationCtx,
  projectId: import("../_generated/dataModel").Id<"projects">,
) {
  const userId = await requireUserId(ctx);
  const project = await ctx.db.get(projectId);

  if (project === null || project.userId !== userId) {
    // Same response either way: a project that isn't yours is a project that
    // doesn't exist, so this can't be used to probe for valid ids.
    throw new ConvexError({ code: "NOT_FOUND", message: "Project not found" });
  }

  return { userId, project };
}
