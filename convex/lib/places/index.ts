/**
 * The waterfall: ask the best provider, fall through when it says no.
 *
 * A sweep is dozens of searches and any one of them can be the request that
 * exhausts a monthly quota. Before this, that ended the hunt — the user got a
 * half-swept patch and a 401 in a red box. Now the tier that ran out is set
 * aside and the next one picks up the same search, so a sweep finishes even if
 * it starts on Serper and ends on OpenStreetMap.
 *
 * The order is cheapest-and-best first, free-and-always-there last:
 *
 *   1. Serper       — 1–2 credits a page, answers in a second or two.
 *   2. Scrape.do    — 10 credits a page, several seconds. Works; costs more.
 *   3. OpenStreetMap — free, no key, cannot run out. Knows less, and says so.
 *
 * Only *terminal* failures move the waterfall on. A timeout or a 500 is the
 * provider having a bad second and is retried in place; a 401, a 403 or an
 * exhausted quota is an answer, and asking again just burns time.
 */

import * as overpass from "./overpass";
import * as scrapedo from "./scrapedo";
import * as serper from "./serper";
import { PlacesError, type MapsPlace, type SearchArgs } from "./types";

export { PlacesError, type MapsPlace, type SearchArgs };

export type Provider = "serper" | "scrapedo" | "osm";

export interface ProviderInfo {
  name: Provider;
  /**
   * How many searches one scheduled sweep should run on this tier.
   *
   * Serper answers in a second or two, so a sweep can take a real bite out of
   * the plan per action. Scrape.do drives a proxy at Google for every page and
   * takes several seconds. Overpass reads a whole bounding box in one pass and
   * is the slowest of the three per call, so its batches stay smallest — every
   * action has to finish inside Convex's ten-minute ceiling.
   */
  batch: number;
  configured: () => boolean;
  search: (args: SearchArgs) => Promise<MapsPlace[]>;
}

const CHAIN: ProviderInfo[] = [
  { name: "serper", batch: 8, configured: serper.configured, search: serper.search },
  { name: "scrapedo", batch: 3, configured: scrapedo.configured, search: scrapedo.search },
  { name: "osm", batch: 2, configured: overpass.configured, search: overpass.search },
];

/**
 * Tiers that have given a terminal answer.
 *
 * Module scope, so it survives between searches inside one action and usually
 * between actions in the same isolate. Deliberately never cleared: everything
 * that lands here said something that will not change on a retry — a rejected
 * key, or a quota that resets next month, not next minute. Convex recycles
 * isolates on its own, which is what eventually gives a refilled account its
 * place back at the top.
 */
const spent = new Set<Provider>();

/** Whether a failure means "ask someone else" rather than "ask again". */
const terminal = (error: unknown) =>
  error instanceof PlacesError && !error.retryable;

const usable = () => CHAIN.filter((tier) => tier.configured() && !spent.has(tier.name));

/**
 * The tier a sweep should plan around.
 *
 * Used for the batch size and for recording what ran; the actual search may
 * still fall past it mid-flight, which is the point.
 */
export const provider = (): ProviderInfo => usable()[0] ?? CHAIN[CHAIN.length - 1];

/**
 * One page of one Maps search, from the first tier that will answer it.
 *
 * Throws only when every tier has refused. That error carries the last real
 * reason rather than a summary, because "OpenStreetMap is unreachable" is
 * something to wait out and "your Serper key was rejected" is something to
 * fix, and a hunt row that flattened both into "search failed" would tell the
 * user neither.
 */
export const searchPlaces = async (args: SearchArgs): Promise<MapsPlace[]> => {
  const tiers = usable();

  if (tiers.length === 0) {
    throw new PlacesError(
      "Every maps provider is out. Set a fresh SERPER_API_KEY and sweep again.",
      0,
      false,
    );
  }

  let last: unknown;

  for (const tier of tiers) {
    try {
      return await tier.search(args);
    } catch (error) {
      last = error;

      // Retryable failures have already been retried inside the provider, so
      // reaching here means this tier is done for now either way — but only a
      // terminal answer takes it out of the chain for good.
      if (terminal(error)) spent.add(tier.name);
    }
  }

  throw last instanceof Error
    ? last
    : new PlacesError(`Every maps provider failed: ${String(last)}`, 0, true);
};
