import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Ported from prisma/schema.prisma. Two things changed shape on the way over:
//
//  - `_id` and `_creationTime` are automatic, so the uuid `id` and `createdAt`
//    columns are gone. `updatedAt` is kept as an explicit number only where
//    something actually sorts by it.
//  - Postgres cascade deletes have no equivalent here. Deleting a project
//    must explicitly delete its messages and their fragments; see
//    `deleteProject` in convex/projects.ts.
//
// The `Usage` table is deliberately absent — credits moved to the
// @convex-dev/rate-limiter component, which owns its own storage.

export const messageRole = v.union(v.literal("USER"), v.literal("ASSISTANT"));
export const messageType = v.union(v.literal("RESULT"), v.literal("ERROR"));

export default defineSchema({
  projects: defineTable({
    // Clerk user id. A plain string, not a relation — Clerk owns the user
    // record and there is no local users table to point at.
    userId: v.string(),
    name: v.string(),
    // Bumped on every new message so the sidebar can sort by recent activity.
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_updated", ["userId", "updatedAt"]),

  messages: defineTable({
    projectId: v.id("projects"),
    content: v.string(),
    role: messageRole,
    type: messageType,
  }).index("by_project", ["projectId"]),

  fragments: defineTable({
    messageId: v.id("messages"),
    sandboxUrl: v.string(),
    title: v.string(),
    // Path -> file contents for the generated project.
    //
    // A Convex document is capped at 1 MiB, and this map is the only field
    // here that grows with the size of what the agent wrote. The write path
    // in convex/messages.ts checks the encoded size and fails loudly rather
    // than letting the platform reject the row after a 30-minute build. If
    // real projects start tripping it, the fix is to move this blob to
    // ctx.storage and keep an Id<"_storage"> in its place.
    files: v.record(v.string(), v.string()),
  }).index("by_message", ["messageId"]),

  profiles: defineTable({
    userId: v.string(),
    // Signs every pitch and brands the sites they send.
    tradingName: v.string(),
    // Experience slug — how much hand-holding the guidance gives.
    experience: v.string(),
    // Where they sell. Drives which businesses we look for.
    city: v.string(),
    // Trade slugs from ONBOARDING_INDUSTRIES.
    industries: v.array(v.string()),
    // Price band slug — the number the pitch anchors to.
    priceBand: v.string(),
    // Tone slug — the register of the generated site copy and outreach.
    tone: v.string(),

    // --- Connections. Optional: set on the connections screen after
    // onboarding, and skippable, so every field here is nullable.

    // Nango connection id for the user's Gmail account. Nango holds the
    // OAuth tokens and refreshes them; we only keep the handle. Absent
    // until they finish the Google consent flow.
    gmailConnectionId: v.optional(v.string()),
    // The Google address that was connected, shown on the connections
    // screen so they can see which inbox pitches will send from.
    gmailEmail: v.optional(v.string()),
    // Stripe connected account id, once they finish Connect onboarding.
    stripeAccountId: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  feedback: defineTable({
    userId: v.string(),
    // What kind of note this is, so the inbox can be triaged without reading
    // every line.
    kind: v.union(
      v.literal("idea"),
      v.literal("bug"),
      v.literal("praise"),
      v.literal("other"),
    ),
    message: v.string(),
    // Captured at submit time. Clerk owns the address and it can change, but
    // a reply needs to go somewhere even if the account is later deleted.
    email: v.optional(v.string()),
  }).index("by_user", ["userId"]),
});
