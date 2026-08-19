import { renderSite, templateFor } from "@/blocks/render";
import type { BusinessFacts } from "@/blocks/types";
import { composeSite } from "@/compose";
import { configured as canPublish, publishSite, slugCandidates } from "@/publish";

import { inngest } from "./client";
import { claimLeadSite, fetchLeadContext, recordLeadSite } from "./convex";

/**
 * The fast lane.
 *
 * One lead in, one published website out, in about the time it takes to read
 * this sentence. No sandbox, no npm, no build: a model writes the words, a
 * template turns them into a page, and the page goes into the bucket.
 *
 * It exists because of the arithmetic on the other lane. A full agent build is
 * three to five minutes of a container and tens of thousands of tokens, and
 * roughly three cold pitches in a hundred are ever answered — so building every
 * lead properly means spending ninety-seven percent of the money and nearly all
 * of the wall-clock on sites nobody will ever open. This builds all hundred for
 * about a dollar, and the slow lane is kept for the three who replied.
 *
 * The other reason is that it cannot really fail. The design is fixed and was
 * written by a person; the model only fills in sentences. There is no compile
 * step to break, so the worst outcome is a page that is plainer than it might
 * have been, rather than a project with nothing at the end of it.
 */

export const fastSiteFunction = inngest.createFunction(
  {
    id: "fast-site",
    // The ceiling is the free tiers', not ours. Gemini is generous and
    // Cerebras allows five requests a minute; a handful at a time keeps the
    // fallback in providers.ts as a safety net rather than the normal path.
    concurrency: { limit: 4 },
    retries: 2,
    // Two runs for the same lead is the queue being enthusiastic, not two
    // pieces of work. The later one wins and the earlier is dropped.
    idempotency: "event.data.leadId",
  },
  { event: "fast-site/build" },
  async ({ event, step }) => {
    const leadId: string = event.data.leadId;
    const force: boolean = Boolean(event.data.force);

    if (!canPublish()) {
      throw new Error(
        "Publishing is not configured. Set CLOUDFLARE_ACCOUNT_ID, " +
          "CLOUDFLARE_API_TOKEN and SITES_DOMAIN in .env.",
      );
    }

    const domain = process.env.SITES_DOMAIN as string;

    const lead = await step.run("read-lead", async () => {
      const { lead } = await fetchLeadContext(leadId);
      return lead;
    });

    if (!lead) return { skipped: "gone" as const };

    // The queue re-enqueues a whole patch, and most of a patch was built the
    // last time it ran. Rebuilding a live site to produce the same page costs
    // a model call and risks replacing copy somebody has already pitched.
    if (lead.alreadyLive && !force) return { skipped: "already-live" as const };

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

    try {
      // The address is settled before a word is written. It is the cheapest
      // step and the only one that can be refused outright, and finding out
      // that a name is unavailable after paying for the copy is the wrong
      // order to find it out in.
      const site = await step.run("claim-address", () =>
        claimLeadSite({
          leadId,
          candidates: slugCandidates(lead.name, leadId),
          domain,
        }),
      );

      // Every category, not just the first: the word that identifies the trade
      // is often in the second one. See templateFor. Pure, so not a step —
      // a step is for work that must not be repeated on a retry.
      const template = templateFor(...lead.categories, lead.trade);

      // Writing, checking and correcting are one step rather than three.
      // They share a photo verdict and a running token count, and splitting
      // them would mean a retry that resumed between two of them paying for
      // the image check a second time.
      const composed = await step.run("compose", async () => {
        const result = await composeSite(facts, lead.categories, template, {
          tone: lead.tone,
        });

        return {
          content: result.content,
          problems: result.problems.map((p) => `${p.severity}:${p.field} — ${p.message}`),
          unresolved: result.unresolved.map((p) => `${p.field} — ${p.message}`),
          photo: result.photo ?? null,
          photoSkipped: result.photoSkipped ?? null,
          repairs: result.repairs,
          tokens: result.tokens,
          provider: result.provider,
        };
      });

      const published = await step.run("publish", async () => {
        const { files, bytes } = renderSite(composed.content, {
          template,
          siteUrl: site.url,
        });

        await publishSite(site.slug, files);

        return { bytes, files: files.length };
      });

      await step.run("record", () =>
        recordLeadSite({ leadId, slug: site.slug, url: site.url, template }),
      );

      return {
        url: site.url,
        template,
        bytes: published.bytes,
        provider: composed.provider,
        tokens: composed.tokens,
        repairs: composed.repairs,
        photo: composed.photo,
        // Returned rather than only acted on, so a template or a prompt that
        // starts producing the same complaint on every site is visible in the
        // run history instead of only in the pages it quietly trimmed.
        problems: composed.problems,
        unresolved: composed.unresolved,
      };
    } catch (cause) {
      // Recorded rather than swallowed. A lead stuck on "building" forever
      // looks identical to one the queue has not reached yet, and the whole
      // point of the status is telling those two apart.
      await step.run("record-failure", () =>
        recordLeadSite({ leadId, error: String(cause) }),
      );

      throw cause;
    }
  },
);
