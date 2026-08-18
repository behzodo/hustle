import { renderSite, templateFor } from "@/blocks/render";
import type { BusinessFacts } from "@/blocks/types";
import { composeSite } from "@/compose";
import { claimLeadSite, fetchLeadContext, recordLeadSite } from "@/inngest/convex";
import { publishSite, slugCandidates } from "@/publish";

/**
 * Builds sites for real leads, from the command line.
 *
 *   npm run site:build -- <leadId> [<leadId> ...]
 *
 * The same sequence as src/inngest/fast.ts, without Inngest around it. Useful
 * for building one site on demand, and for checking a change to a template or
 * to the prompt against real listings rather than against the tidy samples in
 * blocks-preview.
 */

const build = async (leadId: string) => {
  const started = Date.now();
  const { lead } = await fetchLeadContext(leadId);

  if (!lead) {
    console.log(`${leadId}  gone`);
    return;
  }

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
    const site = await claimLeadSite({
      leadId,
      candidates: slugCandidates(lead.name, leadId),
      domain: process.env.SITES_DOMAIN as string,
    });

    const template = templateFor(...lead.categories, lead.trade);
    const composed = await composeSite(facts, lead.categories, template, {
      tone: lead.tone,
    });

    const { files, bytes } = renderSite(composed.content, {
      template,
      siteUrl: site.url,
    });

    await publishSite(site.slug, files);
    await recordLeadSite({ leadId, slug: site.slug, url: site.url, template });

    const seconds = ((Date.now() - started) / 1000).toFixed(1);

    console.log(`\n${lead.name}`);
    console.log(`  ${lead.categories.join(", ")}  ->  ${template}`);
    console.log(`  "${composed.content.copy.headline}"`);
    console.log(
      `  ${composed.provider}, ${composed.tokens} tokens, ${composed.repairs} repair(s), ${bytes} bytes, ${seconds}s`,
    );

    if (composed.photo) console.log(`  photo kept: ${composed.photo}`);
    if (composed.photoSkipped) console.log(`  photo: ${composed.photoSkipped}`);
    for (const problem of composed.problems) {
      console.log(`  [${problem.severity}] ${problem.field}: ${problem.message}`);
    }
    for (const problem of composed.unresolved) {
      console.log(`  STILL WRONG  ${problem.field}: ${problem.message}`);
    }

    console.log(`  ${site.url}`);
  } catch (cause) {
    await recordLeadSite({ leadId, error: String(cause) });
    console.log(`\n${lead.name}\n  FAILED: ${String(cause).slice(0, 300)}`);
  }
};

const main = async () => {
  const ids = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));

  if (ids.length === 0) {
    console.log("Usage: npm run site:build -- <leadId> [<leadId> ...]");
    return;
  }

  const started = Date.now();
  for (const id of ids) await build(id);

  console.log(
    `\n${ids.length} site(s) in ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );
};

void main();
