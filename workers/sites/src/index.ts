/**
 * The shop window.
 *
 * Every site the agent builds is a folder of static files in one R2 bucket,
 * keyed by the slug it was published under. This serves them: the subdomain of
 * the request says which folder, the path says which file.
 *
 *   kellerman-plumbing.korvians.online/about
 *   → bucket key "kellerman-plumbing/about/index.html"
 *
 * It is a Worker rather than a bucket made public because a public bucket
 * cannot do the two things that make this a website instead of a file share:
 * map a hostname onto a prefix, and answer a path that has no file at it.
 *
 * The whole point is that these outlive the sandbox they were built in. A
 * sandbox is minutes; a client keeps the link. R2 charges nothing for traffic
 * leaving it, so a site that does well costs the same as one nobody visits.
 */

interface Env {
  SITES: R2Bucket;
  /** The domain sites are published under, e.g. "korvians.online". */
  SITES_DOMAIN: string;
  /**
   * Origins allowed to show these pages inside a frame, space separated.
   *
   * The dashboard previews every site it built as a live tile, which is a
   * frame, which the old `X-Frame-Options: SAMEORIGIN` on this response
   * forbade outright — every tile rendered as a blocked-content icon. The
   * header was right to exist and wrong to be absolute.
   *
   * Replaced by `frame-ancestors`, which says the same thing with an
   * exception: our own app may embed a client's site, and nobody else may.
   * The two headers do not co-exist well — where both are sent, browsers
   * honour the CSP and ignore the other — so the old one is gone rather than
   * kept alongside.
   */
  PREVIEW_ORIGINS?: string;
}

/**
 * Content types, by extension.
 *
 * Kept as a table rather than read from R2's stored metadata because the
 * upload is the agent's, and a file uploaded without a type would be served as
 * a download prompt instead of a page. The extension is the thing that is
 * always right.
 */
const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  txt: "text/plain; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  webmanifest: "application/manifest+json",
};

const typeFor = (key: string) =>
  TYPES[key.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";

/**
 * Vite fingerprints what it builds — `index-D01uD1fY.js`. A fingerprinted file
 * can never change under its own name, so it is cached for a year; anything
 * else has to be revalidated or a client would keep seeing the site as it was
 * the first time they opened it.
 */
const FINGERPRINTED = /-[A-Za-z0-9_]{8,}\.(js|css|woff2?|png|jpe?g|svg|webp|avif)$/;

const cacheFor = (key: string) =>
  FINGERPRINTED.test(key)
    ? "public, max-age=31536000, immutable"
    : "public, max-age=0, must-revalidate";

/** "kellerman-plumbing.korvians.online" -> "kellerman-plumbing" */
const slugFrom = (host: string, domain: string) => {
  const name = host.split(":")[0].toLowerCase();
  const suffix = `.${domain.toLowerCase()}`;

  if (!name.endsWith(suffix)) return null;

  const slug = name.slice(0, -suffix.length);

  // One level only. A slug with a dot in it would read as a nested subdomain
  // and could be pointed at a prefix it was never given.
  return slug && !slug.includes(".") ? slug : null;
};

/**
 * The slug behind a domain somebody bought.
 *
 * `joesgym.com` carries no subdomain to read a slug out of, so the answer is
 * written into the bucket at purchase time — see src/domains/map.ts. This is
 * the read of it.
 *
 * Cached in the Worker's own cache rather than looked up every time. A mapping
 * changes when a domain is re-pointed, which is close to never, and a site on
 * a bought domain would otherwise pay two round trips to storage for every
 * request instead of one. Five minutes is short enough that a re-point takes
 * effect while somebody is still looking at the screen that did it.
 */
const CUSTOM_TTL_SEC = 300;

const mappedSlug = async (host: string, env: Env): Promise<string | null> => {
  const name = host.split(":")[0].toLowerCase();

  // A key rather than the request URL: the cache is shared across every site
  // this Worker serves, and keying on the visitor's own URL would store one
  // entry per page rather than one per domain.
  const cacheKey = new Request(`https://sites.internal/_map/${name}`);
  const cache = caches.default;

  const hit = await cache.match(cacheKey);

  if (hit) {
    const { slug } = (await hit.json()) as { slug?: string };
    return slug ?? null;
  }

  const object = await env.SITES.get(`_map/${name}`);
  if (!object) return null;

  const body = await object.text();
  const { slug } = JSON.parse(body) as { slug?: string };

  // One level only, for the same reason as slugFrom: a mapping is a file in
  // the same bucket as the sites, and a slug with a slash in it would read as
  // a path into somebody else's.
  if (!slug || slug.includes("/") || slug.includes(".")) return null;

  await cache.put(
    cacheKey,
    new Response(body, {
      headers: {
        "content-type": "application/json",
        "cache-control": `public, max-age=${CUSTOM_TTL_SEC}`,
      },
    }),
  );

  return slug;
};

/**
 * Who may frame a published site.
 *
 * `'self'` keeps a site able to frame its own pages. Everything after it is
 * ours. A missing variable means nobody but the site itself, which is the safe
 * way to be misconfigured.
 */
const frameAncestors = (env: Env) =>
  `frame-ancestors 'self' ${env.PREVIEW_ORIGINS ?? ""}`.trim();

const notFound = (message: string) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><title>Not found</title>` +
      `<div style="font:16px/1.6 system-ui;max-width:32rem;margin:20vh auto;padding:0 1.5rem">` +
      `<h1 style="font-size:1.25rem;margin:0 0 .5rem">Nothing here</h1>` +
      `<p style="color:#666;margin:0">${message}</p></div>`,
    { status: 404, headers: { "content-type": "text/html; charset=utf-8" } },
  );

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Our own subdomain first, because it is every site's address the moment
    // it is built and most of them never get another. A bought domain falls
    // through to the mapping, which costs a read the common case does not pay.
    const slug =
      slugFrom(url.hostname, env.SITES_DOMAIN) ??
      (await mappedSlug(url.hostname, env));

    if (!slug) return notFound("That address does not point at a site.");

    // A directory request is a request for the page inside it, so both "/" and
    // "/about" become an index.html — which is what a static build produces
    // for every route it has.
    const path = url.pathname.replace(/^\/+/, "");
    const candidates =
      path === "" || path.endsWith("/")
        ? [`${slug}/${path}index.html`]
        : path.includes(".")
          ? [`${slug}/${path}`]
          : [`${slug}/${path}`, `${slug}/${path}/index.html`];

    for (const key of candidates) {
      const object = await env.SITES.get(key);
      if (!object) continue;

      return new Response(object.body, {
        headers: {
          "content-type": typeFor(key),
          "cache-control": cacheFor(key),
          etag: object.httpEtag,
          // These sites are built by a language model from a prompt, so the
          // content type it declares is the one it gets, and who may wrap a
          // frame around it is decided here rather than by whoever asks.
          "x-content-type-options": "nosniff",
          "content-security-policy": frameAncestors(env),
        },
      });
    }

    // Published sites answer their own unknown paths with the app shell, so a
    // deep link into one still renders. An unpublished slug has no shell, and
    // saying so is more useful than a blank page.
    const shell = await env.SITES.get(`${slug}/index.html`);

    if (!shell) {
      return notFound("No site has been published at this address yet.");
    }

    return new Response(shell.body, {
      status: 404,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=0, must-revalidate",
        "x-content-type-options": "nosniff",
        "content-security-policy": frameAncestors(env),
      },
    });
  },
};
