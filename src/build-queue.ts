import "server-only";

import { renderSite, templateFor } from "@/blocks/render";
import type { BusinessFacts } from "@/blocks/types";
import { composeSite } from "@/compose";
import {
  claimLeadSite,
  fetchLeadContext,
  queueProjectSites,
  recordLeadSite,
  takeNextSite,
} from "@/inngest/convex";
import { publishSite, slugCandidates } from "@/publish";

/**
 * Working through a hustle's queue.
 *
 * A swept patch is a few hundred businesses and the free tiers will carry a
 * handful at a time, so the shape is a small pool of workers pulling from a
 * shared queue rather than a loop over a list. The difference is what happens
 * when one business takes four seconds and the next takes twenty: a pool has
 * the other three workers already on the next three businesses, where a batched
 * loop has them waiting for the slow one to finish before anybody starts.
 *
 * Nothing here decides what order to work in. `takeNextSite` does, in Convex,
 * best score first — because the ordering has to survive being asked by four
 * workers at once, and that is a property of the mutation rather than of any
 * list this side could hold.
 */

/**
 * How many businesses are built at once.
 *
 * Bounded by the model's rate limits rather than by anything here: Cerebras
 * allows five requests a minute, so four in flight keeps a request spare for
 * the repair pass that a fifth of sites need. Raising this does not make the
 * queue faster, it makes it fail over to Groq more often.
 */
export const WORKERS = 4;

export interface BuiltSite {
  leadId: string;
  name: string;
  url: string;
  template: string;
  seconds: number;
  tokens: number;
  provider: string;
  repairs: number;
  problems: string[];
}

export interface FailedSite {
  leadId: string;
  name: string;
  error: string;
}

export interface QueueEvents {
  onStart?: (lead: { leadId: string; name: string; score: number }) => void;
  onBuilt?: (site: BuiltSite) => void;
  onFailed?: (site: FailedSite) => void;
}

/**
 * Builds one business, start to finish.
 *
 * Exported because both the pool below and the Inngest function build exactly
 * this, and a second copy of the sequence is a second place for the order of
 * claim-then-write-then-publish to drift.
 */
export const buildLeadSite = async (
  leadId: string,
  domain: string,
): Promise<BuiltSite> => {
  const started = Date.now();
  const { lead } = await fetchLeadContext(leadId);

  if (!lead) throw new Error("That business is no longer in the hustle.");

  const facts: BusinessFacts = {
    name: lead.name,
    trade: lead.trade,
    town: lead.town,
    phone: lead.phone,
    address: lead.address,
    mapsUrl: lead.mapsUrl,
    rating: lead.rating,
    reviewCount: lead.reviewCount,
    photo: lead.photo,
  };

  // Before any model call: it is the cheapest step and the only one that can
  // be refused outright.
  const site = await claimLeadSite({
    leadId,
    candidates: slugCandidates(lead.name, leadId),
    domain,
  });

  const template = templateFor(...lead.categories, lead.trade);
  const composed = await composeSite(facts, lead.categories, template, {
    tone: lead.tone,
  });

  const { files } = renderSite(composed.content, { template, siteUrl: site.url });

  await publishSite(site.slug, files);
  await recordLeadSite({ leadId, slug: site.slug, url: site.url, template });

  return {
    leadId,
    name: lead.name,
    url: site.url,
    template,
    seconds: (Date.now() - started) / 1000,
    tokens: composed.tokens,
    provider: composed.provider,
    repairs: composed.repairs,
    problems: composed.problems.map((p) => `${p.severity}:${p.field}`),
  };
};

export interface QueueResult {
  queued: number;
  skipped: number;
  built: BuiltSite[];
  failed: FailedSite[];
  seconds: number;
}

/**
 * Fills a hustle's queue and works it to the bottom.
 *
 * A worker that fails a business records the failure and takes the next one.
 * One business with a name no slug can be made from, or a listing deleted
 * between the sweep and now, must not stop the other two hundred — and the
 * failure is written to the lead, so what stopped is visible on the card
 * rather than only in whatever was watching this run.
 */
export const runQueue = async (
  projectId: string,
  options: { rebuild?: boolean; workers?: number; events?: QueueEvents } = {},
): Promise<QueueResult> => {
  const domain = process.env.SITES_DOMAIN;

  if (!domain) throw new Error("SITES_DOMAIN is not set.");

  const started = Date.now();
  const { queued, skipped } = await queueProjectSites({
    projectId,
    rebuild: options.rebuild,
  });

  const built: BuiltSite[] = [];
  const failed: FailedSite[] = [];
  const events = options.events ?? {};

  const worker = async () => {
    for (;;) {
      const { next } = await takeNextSite(projectId);
      if (!next) return;

      events.onStart?.(next);

      try {
        const site = await buildLeadSite(next.leadId, domain);
        built.push(site);
        events.onBuilt?.(site);
      } catch (cause) {
        const error = String(cause);

        // Recorded before moving on, so the lead leaves "building" — a status
        // it would otherwise keep forever, looking to every later run like
        // work already in progress.
        await recordLeadSite({ leadId: next.leadId, error }).catch(() => {});

        const record = { leadId: next.leadId, name: next.name, error };
        failed.push(record);
        events.onFailed?.(record);
      }
    }
  };

  await Promise.all(
    Array.from({ length: options.workers ?? WORKERS }, () => worker()),
  );

  return {
    queued,
    skipped,
    built,
    failed,
    seconds: (Date.now() - started) / 1000,
  };
};
