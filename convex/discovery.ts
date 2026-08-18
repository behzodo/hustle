import { v, ConvexError } from "convex/values";

import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { huntQueryValidator, webPresence } from "./schema";
import { requireOwnedProject, requireUserId } from "./lib/auth";
import { PlacesError, provider, searchPlaces } from "./lib/places";
import {
  PAGES_PER_QUERY,
  planHunt,
  requestsFor,
  termsIn,
  tilesFor,
  withinArea,
} from "../src/modules/hustles/discovery/plan";
import { termsFor } from "../src/modules/hustles/discovery/terms";
import { isTarget, readWebsite, scoreLead } from "../src/modules/hustles/discovery/lead";

/**
 * The discovery engine: a drawn patch in, a list of businesses without a
 * website out.
 *
 * It runs here rather than on Inngest because the result is the point of the
 * screen watching it. Every listing absorbed lands in the `leads` table, and
 * every open tab's `useQuery` updates on its own — the sweep on screen is the
 * real sweep, not a stand-in for one. The agent build stays on Inngest for the
 * opposite reason: it is thirty minutes of sandbox work with one result at the
 * end and nothing to watch in between.
 *
 * A Convex action is capped at ten minutes and a wide patch is dozens of slow
 * scrapes, so no single action tries to run the whole plan. `sweep` takes a
 * few searches, writes what it found, and schedules itself again from where it
 * left off. That is also what makes a mid-sweep failure survivable: the leads
 * already found are already saved.
 */

// How many searches one scheduled sweep runs is the provider's call — a fast
// one can take a real bite out of the plan per action, a slow one has to stay
// well inside the ten-minute ceiling. See convex/lib/places/index.ts.

/**
 * Ceiling on how much of a lead list one read can pull.
 *
 * `limit` arrives from the client, and a Convex query that tries to read tens
 * of thousands of documents fails outright rather than returning slowly — so
 * an unclamped page size is a query that breaks for exactly the users with the
 * most leads.
 */
const PAGE_MAX = 500;

const clampLimit = (limit: number | undefined, fallback: number) =>
  limit === undefined || !Number.isFinite(limit)
    ? fallback
    : Math.min(PAGE_MAX, Math.max(1, Math.floor(limit)));

const huntStatus = v.union(
  v.literal("running"),
  v.literal("done"),
  v.literal("failed"),
  v.literal("stopped"),
);

const huntShape = v.object({
  _id: v.id("hunts"),
  _creationTime: v.number(),
  projectId: v.id("projects"),
  userId: v.string(),
  status: huntStatus,
  queries: v.array(huntQueryValidator),
  cursor: v.number(),
  scanned: v.number(),
  found: v.number(),
  outside: v.optional(v.number()),
  requests: v.number(),
  startedAt: v.number(),
  finishedAt: v.optional(v.number()),
  error: v.optional(v.string()),
  gl: v.string(),
  provider: v.optional(v.string()),
});

const leadShape = v.object({
  _id: v.id("leads"),
  _creationTime: v.number(),
  projectId: v.id("projects"),
  userId: v.string(),
  huntId: v.id("hunts"),
  placeId: v.string(),
  name: v.string(),
  lat: v.number(),
  lng: v.number(),
  address: v.optional(v.string()),
  phone: v.optional(v.string()),
  website: v.optional(v.string()),
  presence: webPresence,
  target: v.boolean(),
  socialKind: v.optional(v.string()),
  rating: v.optional(v.number()),
  reviewCount: v.optional(v.number()),
  categories: v.array(v.string()),
  photo: v.optional(v.string()),
  score: v.number(),
  term: v.string(),
});

/** A listing as the sweep hands it to the writer. */
const findShape = v.object({
  placeId: v.string(),
  name: v.string(),
  lat: v.number(),
  lng: v.number(),
  address: v.optional(v.string()),
  phone: v.optional(v.string()),
  website: v.optional(v.string()),
  rating: v.optional(v.number()),
  reviewCount: v.optional(v.number()),
  categories: v.array(v.string()),
  photo: v.optional(v.string()),
  term: v.string(),
  // Absent for the Google-shaped providers, where a blank website means the
  // owner has none. False from OpenStreetMap, where it means nobody said.
  websiteKnown: v.optional(v.boolean()),
});

/**
 * Which Google to ask.
 *
 * The wizard only allows the US and Canada, and the geocoder puts the country
 * at the end of the label it saves. Asking google.com about a Toronto patch
 * still returns Toronto, but the prices, phone formats and the businesses it
 * favours all come back American.
 */
const countryFor = (label: string) => (/canada\s*$/i.test(label.trim()) ? "ca" : "us");

// --- Starting and stopping --------------------------------------------------

/**
 * Plan a sweep of this hustle's patch and start it.
 *
 * Returns the running hunt untouched if there already is one, so a double
 * click on the button does not double the bill.
 */
export const start = mutation({
  args: { projectId: v.id("projects") },
  returns: v.id("hunts"),
  handler: async (ctx, { projectId }) => {
    const { userId, project } = await requireOwnedProject(ctx, projectId);

    if (project.area === undefined) {
      throw new ConvexError({
        code: "NO_AREA",
        message: "This hustle has no patch to search. Draw one first.",
      });
    }

    const latest = await ctx.db
      .query("hunts")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .first();

    if (latest !== null && latest.status === "running") return latest._id;

    // The trades the user sells decide what we type into Maps. Without a
    // profile the sweep still runs, on a sensible default set — see termsFor.
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const queries = planHunt(project.area, termsFor(profile?.industries ?? []));

    if (queries.length === 0) {
      throw new ConvexError({
        code: "EMPTY_PLAN",
        message: "There is nothing to search in that patch.",
      });
    }

    const huntId = await ctx.db.insert("hunts", {
      projectId,
      userId,
      status: "running",
      queries,
      cursor: 0,
      scanned: 0,
      found: 0,
      outside: 0,
      requests: 0,
      startedAt: Date.now(),
      gl: countryFor(project.area.label),
      provider: provider().name,
    });

    // Scheduled rather than awaited: a mutation cannot make network calls, and
    // the whole transaction rolls back if anything throws — including the
    // schedule itself, so there is no hunt row left pointing at a sweep that
    // never started.
    await ctx.scheduler.runAfter(0, internal.discovery.sweep, { huntId });

    return huntId;
  },
});

/** Stop a running sweep. The leads already found stay. */
export const stop = mutation({
  args: { huntId: v.id("hunts") },
  returns: v.null(),
  handler: async (ctx, { huntId }) => {
    const userId = await requireUserId(ctx);
    const hunt = await ctx.db.get(huntId);

    if (hunt === null || hunt.userId !== userId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Hunt not found" });
    }

    if (hunt.status !== "running") return null;

    // The next scheduled sweep reads this and returns without spending
    // anything, so there is nothing to cancel.
    await ctx.db.patch(huntId, { status: "stopped", finishedAt: Date.now() });
    return null;
  },
});

// --- The sweep --------------------------------------------------------------

export const read = internalQuery({
  args: { huntId: v.id("hunts") },
  returns: v.union(huntShape, v.null()),
  handler: async (ctx, { huntId }) => await ctx.db.get(huntId),
});

/**
 * Run the next few searches, save what they turned up, and queue the rest.
 *
 * Failure is absorbed rather than thrown: an action that throws is retried by
 * Convex, and retrying a Scrape.do call whose credits are already spent bills
 * the user twice for the same page. The hunt is marked failed with the reason
 * on it instead, which is also what the screen needs to say.
 */
export const sweep = internalAction({
  args: { huntId: v.id("hunts") },
  returns: v.null(),
  handler: async (ctx, { huntId }) => {
    const hunt = await ctx.runQuery(internal.discovery.read, { huntId });

    // Gone, finished, or stopped from the UI while this was queued.
    if (hunt === null || hunt.status !== "running") return null;

    const source = provider();
    const batch = hunt.queries.slice(hunt.cursor, hunt.cursor + source.batch);

    if (batch.length === 0) {
      await ctx.runMutation(internal.discovery.finish, { huntId });
      return null;
    }

    const finds: (typeof findShape.type)[] = [];
    let done = 0;
    let requests = 0;
    let failure: string | null = null;

    for (const search of batch) {
      try {
        // Both pages of one search together; the searches themselves stay
        // sequential so the concurrency stays predictable.
        const pages = await Promise.all(
          Array.from({ length: PAGES_PER_QUERY }, (_, page) =>
            searchPlaces({ ...search, page, gl: hunt.gl }),
          ),
        );

        requests += PAGES_PER_QUERY;
        done += 1;

        for (const page of pages) {
          for (const place of page) finds.push({ ...place, term: search.q });
        }
      } catch (error) {
        // Whatever this search cost is already spent, whether it returned
        // anything or not.
        requests += PAGES_PER_QUERY;
        failure = error instanceof PlacesError ? error.message : String(error);
        break;
      }
    }

    // Always before the verdict: a sweep that dies on its fourth search must
    // keep the leads from the first three.
    await ctx.runMutation(internal.discovery.absorb, {
      huntId,
      cursor: hunt.cursor + done,
      requests,
      finds,
    });

    if (failure !== null) {
      await ctx.runMutation(internal.discovery.fail, { huntId, error: failure });
      return null;
    }

    if (hunt.cursor + done >= hunt.queries.length) {
      await ctx.runMutation(internal.discovery.finish, { huntId });
      return null;
    }

    await ctx.scheduler.runAfter(0, internal.discovery.sweep, { huntId });
    return null;
  },
});

/**
 * Write a batch of listings into the project's lead list.
 *
 * Three things happen here, and all three are why this is a mutation rather
 * than part of the action: the patch filter, the dedupe and the verdict all
 * need the database, and all three must share a transaction with the cursor
 * advance so a crash cannot leave the cursor ahead of the leads.
 */
export const absorb = internalMutation({
  args: {
    huntId: v.id("hunts"),
    cursor: v.number(),
    requests: v.number(),
    finds: v.array(findShape),
  },
  returns: v.null(),
  handler: async (ctx, { huntId, cursor, requests, finds }) => {
    const hunt = await ctx.db.get(huntId);
    if (hunt === null) return null;

    const project = await ctx.db.get(hunt.projectId);
    const area = project?.area;

    let scanned = 0;
    let found = 0;
    let outside = 0;

    // The same shop comes back on both pages of a search and again under the
    // next term. Within one batch that is caught here; across batches, by the
    // index lookup below.
    const seen = new Set<string>();

    for (const find of finds) {
      if (seen.has(find.placeId)) continue;
      seen.add(find.placeId);

      // Google answers a viewport, not a shape. Without this a patch drawn
      // around one neighbourhood fills up with the next town over.
      //
      // Counted on the way past rather than dropped silently: a sweep that
      // rejects everything it was given and a sweep that was given nothing
      // both end at zero leads, and the user has to fix a different thing in
      // each case.
      if (area !== undefined && !withinArea(area, find)) {
        outside += 1;
        continue;
      }

      const verdict = readWebsite(find.website, find.websiteKnown ?? true);

      const fields = {
        name: find.name,
        lat: find.lat,
        lng: find.lng,
        ...(find.address === undefined ? {} : { address: find.address }),
        ...(find.phone === undefined ? {} : { phone: find.phone }),
        ...(verdict.website === undefined ? {} : { website: verdict.website }),
        presence: verdict.presence,
        target: isTarget(verdict.presence),
        ...(verdict.socialKind === undefined ? {} : { socialKind: verdict.socialKind }),
        ...(find.rating === undefined ? {} : { rating: find.rating }),
        ...(find.reviewCount === undefined ? {} : { reviewCount: find.reviewCount }),
        categories: find.categories,
        ...(find.photo === undefined ? {} : { photo: find.photo }),
        score: scoreLead({
          presence: verdict.presence,
          reviewCount: find.reviewCount,
          rating: find.rating,
          hasPhone: find.phone !== undefined,
        }),
      };

      const existing = await ctx.db
        .query("leads")
        .withIndex("by_project_and_place", (q) =>
          q.eq("projectId", hunt.projectId).eq("placeId", find.placeId),
        )
        .first();

      if (existing !== null) {
        // A second sighting can carry a phone number or a review count the
        // first one lacked, so the row is topped up — but the counters are
        // not, or one shop found under three terms would read as three leads.
        await ctx.db.patch(existing._id, fields);
        continue;
      }

      await ctx.db.insert("leads", {
        projectId: hunt.projectId,
        userId: hunt.userId,
        huntId,
        placeId: find.placeId,
        term: find.term,
        ...fields,
      });

      scanned += 1;
      if (fields.target) found += 1;
    }

    await ctx.db.patch(huntId, {
      cursor,
      scanned: hunt.scanned + scanned,
      found: hunt.found + found,
      // Absent on every hunt from before this was counted, which is not the
      // same as zero — but treating it as zero only understates a number that
      // is there to explain an empty screen, and those hunts have no screen
      // left to explain.
      outside: (hunt.outside ?? 0) + outside,
      requests: hunt.requests + requests,
    });

    return null;
  },
});

export const finish = internalMutation({
  args: { huntId: v.id("hunts") },
  returns: v.null(),
  handler: async (ctx, { huntId }) => {
    const hunt = await ctx.db.get(huntId);
    if (hunt === null || hunt.status !== "running") return null;

    await ctx.db.patch(huntId, { status: "done", finishedAt: Date.now() });
    return null;
  },
});

export const fail = internalMutation({
  args: { huntId: v.id("hunts"), error: v.string() },
  returns: v.null(),
  handler: async (ctx, { huntId, error }) => {
    const hunt = await ctx.db.get(huntId);
    if (hunt === null || hunt.status !== "running") return null;

    await ctx.db.patch(huntId, {
      status: "failed",
      finishedAt: Date.now(),
      // Truncated: this is shown on screen, and a scraper's error body can be
      // a whole HTML page.
      error: error.slice(0, 300),
    });

    return null;
  },
});

// --- Reading ----------------------------------------------------------------

/** The latest sweep of this hustle, running or not. */
export const status = query({
  args: { projectId: v.id("projects") },
  returns: v.union(huntShape, v.null()),
  handler: async (ctx, { projectId }) => {
    await requireOwnedProject(ctx, projectId);

    return await ctx.db
      .query("hunts")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .first();
  },
});

/**
 * The working list: businesses in the patch, best prospects first.
 *
 * Defaults to targets only. The ones that already have a site stay in the
 * table and stay counted — they are what makes "41 of 260" mean something —
 * but they are not what the user is here to read.
 */
export const leads = query({
  args: {
    projectId: v.id("projects"),
    limit: v.optional(v.number()),
    includeCovered: v.optional(v.boolean()),
  },
  returns: v.array(leadShape),
  handler: async (ctx, { projectId, limit, includeCovered }) => {
    await requireOwnedProject(ctx, projectId);

    const take = clampLimit(limit, 100);

    if (includeCovered) {
      return await ctx.db
        .query("leads")
        .withIndex("by_project_and_score", (q) => q.eq("projectId", projectId))
        .order("desc")
        .take(take);
    }

    return await ctx.db
      .query("leads")
      .withIndex("by_project_target_and_score", (q) =>
        q.eq("projectId", projectId).eq("target", true),
      )
      .order("desc")
      .take(take);
  },
});

/**
 * Everything on the map for this hustle, hits and misses alike.
 *
 * Separate from `leads` because the sweep view needs the businesses that were
 * passed over as much as the ones that were kept — a map showing only targets
 * says the whole patch is one, which is never true.
 */
export const pins = query({
  args: { projectId: v.id("projects"), limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id("leads"),
      name: v.string(),
      lat: v.number(),
      lng: v.number(),
      presence: webPresence,
    }),
  ),
  handler: async (ctx, { projectId, limit }) => {
    await requireOwnedProject(ctx, projectId);

    const rows = await ctx.db
      .query("leads")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .take(clampLimit(limit, 400));

    return rows.map(({ _id, name, lat, lng, presence }) => ({
      _id,
      name,
      lat,
      lng,
      presence,
    }));
  },
});

/**
 * What a sweep would cost, and what it would leave out, before anyone pays.
 *
 * The plan is deterministic, so these are the real numbers rather than an
 * estimate — the same call `start` makes, without the insert.
 *
 * `skipped` matters as much as `terms`. A wide patch spends its whole request
 * budget on the first few trades, and a user who picked six at onboarding
 * should be told which two this patch has no room for rather than left to
 * conclude their town has no dentists.
 */
export const quote = query({
  args: { projectId: v.id("projects") },
  returns: v.object({
    /** Billed pages. Each is charged separately by Scrape.do. */
    requests: v.number(),
    searches: v.number(),
    tiles: v.number(),
    /** Trades this patch has room to search, in the order they will run. */
    terms: v.array(v.string()),
    /** Trades the request budget could not fit. */
    skipped: v.array(v.string()),
  }),
  handler: async (ctx, { projectId }) => {
    const { userId, project } = await requireOwnedProject(ctx, projectId);

    if (project.area === undefined) {
      return { requests: 0, searches: 0, tiles: 0, terms: [], skipped: [] };
    }

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const wanted = termsFor(profile?.industries ?? []);
    const queries = planHunt(project.area, wanted);
    const terms = termsIn(queries);

    return {
      requests: requestsFor(queries),
      searches: queries.length,
      tiles: tilesFor(project.area).tiles.length,
      terms,
      skipped: wanted.filter((term) => !terms.includes(term)),
    };
  },
});
