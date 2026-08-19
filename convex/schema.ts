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

// Where a pitch has got to.
//
// "sending" is a claim rather than a fact, the same as a lead's "building":
// a worker that dies between claiming the row and Gmail answering leaves it
// set forever, so it carries a `startedAt` for the same staleness check.
//
// "won" and "lost" are set by hand or by reading a reply. Neither is final in
// any technical sense — a business that said no is still a business with no
// website — but the inbox has to stop showing something at some point.
export const pitchStatus = v.union(
  v.literal("drafted"),
  v.literal("queued"),
  v.literal("sending"),
  v.literal("sent"),
  v.literal("replied"),
  v.literal("won"),
  v.literal("lost"),
  v.literal("failed"),
);

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
    // The sandbox this project's site was last built in.
    //
    // Kept so the next message about a site can be answered on the bench that
    // still has that site on it, rather than rebuilding the tree from nothing
    // every time. The provider travels with the id because it is the only way
    // to know who to ask: an id from one vendor means nothing to another, and
    // asking the wrong one returns "gone" rather than an error worth reading.
    //
    // Absent until a build finishes, and safe to be stale — a bench that has
    // been reaped simply produces a fresh one.
    bench: v.optional(v.object({ id: v.string(), provider: v.string() })),
    // Where this project's site is published, once it has been.
    //
    // The slug is claimed on the first successful build and then never
    // changes, because it is the address a client was given. A rename of the
    // project, a rebuild, a different sandbox — none of them may move it. That
    // is the whole reason it is stored on the project rather than derived from
    // the name every time.
    site: v.optional(
      v.object({
        // The subdomain, e.g. "joes-gym" for joes-gym.korvians.online.
        slug: v.string(),
        // The full address, kept whole so nothing has to rebuild it from the
        // slug and an environment variable that may since have changed.
        url: v.string(),
        // Absent between claiming the name and the first upload landing.
        publishedAt: v.optional(v.number()),
      }),
    ),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_updated", ["userId", "updatedAt"])
    // Uniqueness, enforced by looking before claiming. Two barbers called Fade
    // in one city is not a rare event, and the loser of that race would
    // otherwise overwrite the winner's site.
    .index("by_slug", ["site.slug"]),

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
    // Listings Google returned that fell *outside* it, and were discarded.
    //
    // Kept because it is the difference between the two ways a sweep comes
    // back empty, and they need opposite fixes: nothing here means the search
    // found nothing at all, while a large number means the search worked and
    // the patch is in the wrong place — a pin in open water, or a postcode
    // centroid sitting eighty kilometres from the town it is named after.
    // Without it both read as "your town has no businesses".
    //
    // Sightings rather than distinct businesses: a shop rejected under three
    // search terms in three different batches counts three times, because
    // nothing outside the patch is stored to dedupe against.
    outside: v.optional(v.number()),
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
    // A picture of the place, on Google's CDN. Came free with the search that
    // found it — see MapsPlace.photo.
    //
    // The URL is stored rather than the image. Copying a few hundred thumbnails
    // per sweep into file storage would make a sweep slower and heavier for a
    // picture the user may look at once. The cost is that these URLs carry a
    // token and can eventually stop resolving, so the card treats a photo as
    // something that might not load rather than something that will.
    photo: v.optional(v.string()),
    // 0–100, worth-pitching-ness. See scoreLead().
    score: v.number(),
    // The search phrase that turned it up, so a surprising lead can be
    // explained rather than mistrusted.
    term: v.string(),
    // The site built for this business, once one has been.
    //
    // Every lead gets its own — that is the product. A hustle is a patch of a
    // town and a lead is one shop in it, so the address belongs to the shop
    // and not to the sweep that found it.
    //
    // Claimed on the first build and never moved afterwards, for the same
    // reason as projects.site: it is what went in an email.
    site: v.optional(
      v.object({
        slug: v.string(),
        url: v.string(),
        // Which of the four looks was used, so a rebuild is consistent and a
        // template that turns out to be wrong for a trade can be found again.
        template: v.string(),
        publishedAt: v.number(),
        // What the robot did to get here.
        //
        // Kept because the page it produced is not the whole story and the
        // rest of it is otherwise thrown away: which model wrote it, what the
        // checks caught, whether it had to be corrected, what the photograph
        // turned out to be. That is the difference between a screen that says
        // a site exists and one that can be opened up and understood — and it
        // is the only record of a check having fired, since the fix lands in
        // the copy and leaves no trace there.
        //
        // Optional: every site built before this was stored has none.
        build: v.optional(
          v.object({
            provider: v.string(),
            tokens: v.number(),
            repairs: v.number(),
            seconds: v.number(),
            headline: v.string(),
            services: v.array(v.string()),
            // What the checker caught, in its own words. Empty is the normal
            // case and is worth showing as much as a full one.
            problems: v.array(v.string()),
            // What the photograph was judged to be, or why it was not used.
            photo: v.optional(v.string()),
          }),
        ),
      }),
    ),
    // Where this lead is in the build queue. Absent means never queued —
    // which is every lead swept before the fast lane existed.
    siteStatus: v.optional(
      v.union(
        v.literal("queued"),
        v.literal("building"),
        v.literal("live"),
        v.literal("failed"),
      ),
    ),
    // Why it failed, shown on the card. A lead that failed silently looks
    // identical to one nobody has got to yet.
    siteError: v.optional(v.string()),
    // When the current build started.
    //
    // Only meaningful while `siteStatus` is "building", and it exists because
    // that status is a claim rather than a fact: a worker that dies mid-build
    // never clears it, and without a time to compare against, the business it
    // was working on stays claimed by nobody forever. See STALE_BUILD_MS.
    siteStartedAt: v.optional(v.number()),
    // Where to send the pitch.
    //
    // Not on the listing. Google Maps gives a phone number and never an email,
    // which is the one fact that decides the shape of this whole lane: the
    // business has to be found a second time, on whatever page they do have,
    // or the address has to be typed in by hand.
    //
    // `checkedAt` is what stops that search repeating. A business with no
    // email anywhere is the common case, and without a record of having
    // looked, every run would look again — a few hundred fetches to learn
    // the same nothing.
    contact: v.optional(
      v.object({
        email: v.optional(v.string()),
        // "social", "website", "manual". Kept because a hand-typed address is
        // worth more trust than one regexed off a Linktree, and because an
        // address that bounces should be explainable.
        source: v.optional(v.string()),
        checkedAt: v.optional(v.number()),
      }),
    ),
  })
    .index("by_project", ["projectId"])
    // Shares one namespace with projects.site.slug — both publish under the
    // same domain, so both claims check both tables. See convex/sites.ts.
    .index("by_slug", ["site.slug"])
    // The queue: everything in one hustle waiting to be built, best first.
    .index("by_project_status_and_score", ["projectId", "siteStatus", "score"])
    // Dedupe on write. Every absorbed listing checks this before inserting.
    .index("by_project_and_place", ["projectId", "placeId"])
    // Everything found, best first — the denominator view.
    .index("by_project_and_score", ["projectId", "score"])
    // The working list: only the businesses with a gap, best first.
    //
    // There is deliberately no `userId` equivalent. Every screen that reads
    // leads reads one hustle's, because a score only ranks businesses against
    // others in the same patch — and an index nobody queries is still written
    // on every insert.
    .index("by_project_target_and_score", ["projectId", "target", "score"]),

  // One approach to one business: the email, the thread it started, and how
  // it went.
  //
  // Its own table rather than another optional object on the lead, because a
  // pitch has a beginning and an end and there can be a second one. A shop
  // that said no in March is still a shop with no website, and is worth asking
  // again once the site has been rebuilt — which is a new pitch, not an edit
  // of the old one. The lead is the business; this is the attempt.
  pitches: defineTable({
    projectId: v.id("projects"),
    leadId: v.id("leads"),
    userId: v.string(),

    // Copied off the lead rather than looked up.
    //
    // The inbox draws a hundred rows and every one of them shows the business
    // name and what they do. Reading the lead for each would be a hundred
    // extra document reads to draw one screen, and none of these three change
    // after the pitch is written.
    business: v.string(),
    trade: v.string(),
    // The site being pitched, as it was when the email went out. Stored rather
    // than read off the lead because this is the link that was actually sent.
    siteUrl: v.string(),

    to: v.string(),
    subject: v.string(),
    body: v.string(),
    status: pitchStatus,

    // Gmail's own ids, once it has accepted the message.
    //
    // The thread id is the only way a reply arriving days later can be matched
    // back to what it is replying to, and the message id is what a follow-up
    // is threaded onto so it lands in the same conversation rather than as a
    // second cold email.
    gmail: v.optional(
      v.object({
        threadId: v.string(),
        messageId: v.string(),
        // RFC 2822 Message-ID, which is what In-Reply-To has to carry. Gmail's
        // own id is not the same thing and will not thread.
        rfcId: v.optional(v.string()),
      }),
    ),

    // The conversation, oldest first — ours and theirs in one list, because
    // the screen reads it top to bottom and a split would have to be merged
    // to show it.
    thread: v.array(
      v.object({
        side: v.union(v.literal("us"), v.literal("them")),
        text: v.string(),
        at: v.number(),
      }),
    ),

    // What the writer spent, and what the checker caught before it went out.
    // Same reason as leads.site.build: the email is not the whole story and
    // a check that fired leaves no other trace.
    write: v.optional(
      v.object({
        provider: v.string(),
        tokens: v.number(),
        seconds: v.number(),
        rewrites: v.number(),
        problems: v.array(v.string()),
      }),
    ),

    sentAt: v.optional(v.number()),
    // Set while `status` is "sending"; see pitchStatus.
    startedAt: v.optional(v.number()),
    // Why it failed. A pitch that failed silently looks like one nobody sent.
    error: v.optional(v.string()),
    // Absent means unread. The inbox filters on it, which is the only reason
    // it exists — nothing else cares.
    readAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_lead", ["leadId"])
    // The inbox: one hustle's pitches, most recent first.
    .index("by_project_and_updated", ["projectId", "updatedAt"])
    // The queue: everything waiting to go out, oldest first so the one that
    // has been waiting longest is sent first.
    .index("by_project_status_and_updated", ["projectId", "status", "updatedAt"])
    // Every pitch this user has, across hustles. Unlike leads, this one is
    // worth having: an inbox is a place, not a property of a patch.
    .index("by_user_and_updated", ["userId", "updatedAt"])
    // Matching an incoming reply to the pitch it answers.
    .index("by_thread", ["gmail.threadId"]),

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
    // The published address, when this build was published.
    //
    // Separate from `sandboxUrl` because they are different promises.
    // `sandboxUrl` is the bench, live and editable and gone within the hour;
    // this is the copy in R2 that a client can be sent. Optional because
    // every fragment written before publishing existed has only the first.
    siteUrl: v.optional(v.string()),
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
