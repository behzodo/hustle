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

// Where a hustle hunts: a point and how far around it to look. Stored as a
// circle because that is the shape the lead search will ask for — a point,
// a radius — and a drawn polygon would have to be cut back into circles to
// be searched at all.
export const areaValidator = v.object({
  // Human-readable, e.g. "Headingley, Leeds". Display only; the search uses
  // the numbers.
  label: v.string(),
  // Always set, even when a shape was traced — then they describe the circle
  // that encloses it. A place search takes a point and a radius and nothing
  // else, so this keeps the lead search on one code path.
  lat: v.number(),
  lng: v.number(),
  radiusM: v.number(),
  // The traced outline, when the area was drawn rather than dialled in. The
  // enclosing circle above finds the candidates; this narrows them.
  polygon: v.optional(v.array(v.object({ lat: v.number(), lng: v.number() }))),
});

// One billed Google Maps search: a phrase pinned to a point at a zoom. The
// whole plan is fixed when a hunt starts and never grows, so the cost of a
// sweep is knowable before the first request goes out.
export const huntQueryValidator = v.object({
  q: v.string(),
  lat: v.number(),
  lng: v.number(),
  zoom: v.number(),
});

// What a business is using instead of a website. `site` means they have their
// own domain and are not a prospect; see src/modules/hustles/discovery/lead.ts
// for why a Facebook page counts as a gap rather than a website.
export const webPresence = v.union(
  v.literal("none"),
  v.literal("social"),
  v.literal("site"),
  // Only OpenStreetMap produces this: its website tag is crowd-sourced, so an
  // absent one means unrecorded rather than non-existent.
  v.literal("unknown"),
);

export default defineSchema({
  projects: defineTable({
    // Clerk user id. A plain string, not a relation — Clerk owns the user
    // record and there is no local users table to point at.
    userId: v.string(),
    name: v.string(),
    // Bumped on every new message so the sidebar can sort by recent activity.
    updatedAt: v.number(),
    // Optional: every project created before the area step existed has none,
    // and a project can still be started from a plain prompt.
    area: v.optional(areaValidator),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_updated", ["userId", "updatedAt"]),

  messages: defineTable({
    projectId: v.id("projects"),
    content: v.string(),
    role: messageRole,
    type: messageType,
  }).index("by_project", ["projectId"]),

  // One sweep of a hustle's patch: the plan it is working through, how far it
  // has got, and what it cost.
  //
  // The row exists so the sweep can be resumed and so the screen can show it
  // happening. A Convex action is capped at ten minutes and a wide patch is
  // dozens of slow scrapes, so `cursor` is what lets one sweep run across many
  // scheduled actions instead of one that times out halfway and loses
  // everything it had found.
  hunts: defineTable({
    projectId: v.id("projects"),
    // Denormalised from the project so a lead read never needs a second
    // lookup to prove ownership.
    userId: v.string(),
    status: v.union(
      v.literal("running"),
      v.literal("done"),
      v.literal("failed"),
      v.literal("stopped"),
    ),
    queries: v.array(huntQueryValidator),
    // Index of the next unrun query. Equal to `queries.length` when finished.
    cursor: v.number(),
    // Listings Google returned that fell inside the patch.
    scanned: v.number(),
    // Of those, the ones with no website of their own.
    found: v.number(),
    // Billed Scrape.do requests so far. The bill, in plain sight.
    requests: v.number(),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    // Why it stopped, when it stopped badly. Shown to the user — a hunt that
    // fails silently looks like an empty town.
    error: v.optional(v.string()),
    // Country perspective for the search: "us" or "ca".
    gl: v.string(),
    // Which maps provider ran it. Optional because hunts from before the
    // engine could switch providers have none — and because what a sweep cost
    // is only answerable next to who was asked.
    provider: v.optional(v.string()),
  }).index("by_project", ["projectId"]),

  // A business found in a hustle's patch.
  //
  // Businesses that already have their own website are kept, not discarded.
  // They are the denominator: "41 of 260 have no site" is the number that
  // tells a user whether the patch is worth working, and a table holding only
  // the hits cannot produce it. `presence` is what separates the two.
  leads: defineTable({
    projectId: v.id("projects"),
    userId: v.string(),
    huntId: v.id("hunts"),
    // Google's id for the listing. The same business turns up in several
    // overlapping tiles and under several search terms, so this is what stops
    // one shop becoming six leads.
    placeId: v.string(),
    name: v.string(),
    lat: v.number(),
    lng: v.number(),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    // Whatever the listing linked, if anything — including the Facebook page
    // or Linktree that counts as a gap rather than a site.
    website: v.optional(v.string()),
    presence: webPresence,
    // `presence !== "site"`, stored rather than derived so the working list
    // can be an index range instead of a table scan that filters afterwards.
    target: v.boolean(),
    // Which platform, when `presence` is "social". A SocialKind slug.
    socialKind: v.optional(v.string()),
    rating: v.optional(v.number()),
    reviewCount: v.optional(v.number()),
    // Google's own categories, e.g. ["Hair salon", "Barber shop"].
    categories: v.array(v.string()),
    // 0–100, worth-pitching-ness. See scoreLead().
    score: v.number(),
    // The search phrase that turned it up, so a surprising lead can be
    // explained rather than mistrusted.
    term: v.string(),
  })
    .index("by_project", ["projectId"])
    // Dedupe on write. Every absorbed listing checks this before inserting.
    .index("by_project_and_place", ["projectId", "placeId"])
    // Everything found, best first — the denominator view.
    .index("by_project_and_score", ["projectId", "score"])
    // The working list: only the businesses with a gap, best first.
    .index("by_project_target_and_score", ["projectId", "target", "score"]),

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
