import "server-only";

import type { BuiltFile } from "@/workshop";

import * as r2 from "./r2";

export { isReserved, slugCandidates, slugify } from "./slug";
export { configured } from "./r2";

/**
 * Publishing: the step that makes a build outlive the machine it was built on.
 *
 * Before this, a finished site was a preview link on a sandbox — and a sandbox
 * is parked after fifteen idle minutes and archived after an hour. That is the
 * right lifetime for a workbench and the wrong one for something a client was
 * sent. Every link handed out before today was going to die, and the only
 * question was whether it died before or after somebody clicked it.
 *
 * So the built files are copied out to R2 and served from a subdomain that
 * belongs to us. The bench goes on being disposable; the site stops being.
 */

/** A legal DNS label, checked again here rather than trusted from a caller. */
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** How many files go up at once. */
const UPLOAD_BATCH = 8;

export const siteUrl = (slug: string) => `https://${slug}.${r2.sitesDomain()}`;

export interface Published {
  slug: string;
  url: string;
  files: number;
  bytes: number;
}

/**
 * Copies a built site into the bucket and returns where it now lives.
 *
 * Two orderings in here are deliberate.
 *
 * Assets go up before the HTML that references them. Vite fingerprints its
 * output, so a new index.html names files that did not exist a moment ago —
 * publish it first and every visitor in that window gets a page whose script
 * and stylesheet both 404. Doing it the other way round means the worst case
 * is briefly serving the old page, which is a page.
 *
 * And the sweep for files that are no longer part of the site happens last,
 * after everything new is in place. A site is republished while somebody may
 * be looking at it; deleting first would take it apart in front of them.
 */
export const publishSite = async (
  slug: string,
  files: BuiltFile[],
): Promise<Published> => {
  if (!LABEL.test(slug)) {
    throw new Error(`"${slug}" cannot be a subdomain.`);
  }

  if (files.length === 0) {
    throw new Error("There is nothing to publish — the build produced no files.");
  }

  if (!files.some((file) => file.path === "index.html")) {
    throw new Error(
      "The build has no index.html, so the published site would have no front page.",
    );
  }

  const prefix = `${slug}/`;
  const key = (file: BuiltFile) => `${prefix}${file.path}`;

  // Read before anything is written: afterwards every key is a live one.
  const before = await r2.list(prefix);

  const html = files.filter((file) => file.path.endsWith(".html"));
  const rest = files.filter((file) => !file.path.endsWith(".html"));

  await r2.inBatches(rest, UPLOAD_BATCH, (file) => r2.put(key(file), file.bytes));
  await r2.inBatches(html, UPLOAD_BATCH, (file) => r2.put(key(file), file.bytes));

  const live = new Set(files.map(key));
  const stale = before.filter((existing) => !live.has(existing));

  await r2.inBatches(stale, UPLOAD_BATCH, (existing) => r2.remove(existing));

  return {
    slug,
    url: siteUrl(slug),
    files: files.length,
    bytes: files.reduce((total, file) => total + file.bytes.length, 0),
  };
};

/** Takes a published site down. */
export const unpublishSite = async (slug: string): Promise<number> => {
  if (!LABEL.test(slug)) throw new Error(`"${slug}" cannot be a subdomain.`);

  const keys = await r2.list(`${slug}/`);
  await r2.inBatches(keys, UPLOAD_BATCH, (existing) => r2.remove(existing));

  return keys.length;
};
