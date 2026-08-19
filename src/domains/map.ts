import "server-only";

import * as r2 from "@/publish/r2";

/**
 * Which site a bought domain shows.
 *
 * The Worker has always read the slug out of the subdomain — `joes-gym` out of
 * `joes-gym.korvians.online` — and a bought domain has no subdomain to read.
 * So the answer is written down: one tiny object in the same bucket the site
 * itself lives in, named after the hostname, containing the slug.
 *
 * A file in the bucket rather than a KV namespace or a D1 table, and that is
 * the whole point. The Worker already has the bucket bound and already reads
 * from it on every request; a lookup costs one more GET against storage that
 * is next to the files it is about. A second service would be a second thing
 * to provision, a second binding, and a second place for the mapping to be
 * right in one and wrong in the other.
 *
 * The cost is a read per request on a custom domain. The Worker caches it —
 * see workers/sites/src/index.ts — so it is a read per domain per minute in
 * practice, against sites that get a few visits a day.
 */

/** Where the mappings live. Underscored so it cannot collide with a slug. */
const PREFIX = "_map/";

const key = (hostname: string) => `${PREFIX}${hostname.trim().toLowerCase()}`;

/**
 * Points a hostname at a slug.
 *
 * Both the apex and `www`, because the DNS records written at purchase send
 * both here and a visitor who typed the second one should not get a 404 for
 * their trouble.
 */
export const point = async (hostname: string, slug: string): Promise<void> => {
  const body = Buffer.from(JSON.stringify({ slug }), "utf8");

  await r2.put(key(hostname), body);
  await r2.put(key(`www.${hostname}`), body);
};

/** Removes a mapping, so the domain stops resolving to somebody's site. */
export const unpoint = async (hostname: string): Promise<void> => {
  await r2.remove(key(hostname)).catch(() => undefined);
  await r2.remove(key(`www.${hostname}`)).catch(() => undefined);
};
