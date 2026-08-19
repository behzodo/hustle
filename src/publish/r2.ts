import "server-only";

/**
 * R2, over Cloudflare's REST API.
 *
 * Not the S3-compatible endpoint, which is the more usual way in. That one
 * wants its own pair of access keys and an AWS v4 signature, which is a
 * signing implementation and a second secret to keep, both in exchange for a
 * multipart upload path nothing here needs — a built marketing site is a few
 * dozen files and the largest is a font.
 *
 * The REST API takes the Cloudflare token this project already holds for DNS
 * and Workers, and a PUT is a PUT. When a site outgrows that — a video, an
 * image set past a few hundred megabytes — this is the file that changes.
 */

const API = "https://api.cloudflare.com/client/v4";

/** Everything this needs from the environment, or a reason it cannot run. */
const config = () => {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const bucket = process.env.SITES_BUCKET ?? "hustle-sites";
  const domain = process.env.SITES_DOMAIN;

  if (!account || !token || !domain) {
    throw new Error(
      "Publishing is not configured. Set CLOUDFLARE_ACCOUNT_ID, " +
        "CLOUDFLARE_API_TOKEN and SITES_DOMAIN in .env.",
    );
  }

  return { account, token, bucket, domain };
};

export const configured = () =>
  Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID &&
      process.env.CLOUDFLARE_API_TOKEN &&
      process.env.SITES_DOMAIN,
  );

/** The domain sites are published under, e.g. "korvians.online". */
export const sitesDomain = () => config().domain;

/**
 * Content types, by extension.
 *
 * The Worker decides what it serves from the extension and ignores what is
 * stored here — see workers/sites/src/index.ts for why. This is set anyway so
 * that anything else that ever reads the bucket, a person in the dashboard
 * included, sees a file rather than a download.
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

export const typeFor = (key: string) =>
  TYPES[key.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";

/**
 * A key, as it goes into a URL path.
 *
 * Segment by segment, because the slashes are structure — they are what makes
 * "assets/index.js" a path rather than a filename with a slash in it — while
 * anything inside a segment is data and has to survive being one.
 */
const encodeKey = (key: string) => key.split("/").map(encodeURIComponent).join("/");

const objectUrl = (key: string) => {
  const { account, bucket } = config();
  return `${API}/accounts/${account}/r2/buckets/${bucket}/objects/${encodeKey(key)}`;
};

/** Puts one object. Overwrites whatever was at that key. */
export const put = async (key: string, bytes: Buffer): Promise<void> => {
  const response = await fetch(objectUrl(key), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${config().token}`,
      "Content-Type": typeFor(key),
    },
    body: new Uint8Array(bytes),
  });

  if (!response.ok) {
    throw new Error(
      `Could not upload ${key}: ${response.status} ${await response.text()}`,
    );
  }
};

/** Every key under a prefix, following the cursor to the end. */
export const list = async (prefix: string): Promise<string[]> => {
  const { account, bucket, token } = config();
  const keys: string[] = [];
  let cursor: string | undefined;

  do {
    const query = new URLSearchParams({ prefix, per_page: "1000" });
    if (cursor) query.set("cursor", cursor);

    const response = await fetch(
      `${API}/accounts/${account}/r2/buckets/${bucket}/objects?${query}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!response.ok) {
      throw new Error(
        `Could not list ${prefix}: ${response.status} ${await response.text()}`,
      );
    }

    const body = (await response.json()) as {
      result?: { key: string }[];
      result_info?: { cursor?: string; is_truncated?: boolean };
    };

    for (const object of body.result ?? []) keys.push(object.key);

    // Cloudflare returns a cursor whether or not there is more behind it, so
    // the truncation flag is what ends the loop. Trusting the cursor alone
    // walks the same last page forever.
    cursor = body.result_info?.is_truncated ? body.result_info.cursor : undefined;
  } while (cursor);

  return keys;
};

/** Removes one object. A key that is already gone is not an error. */
export const remove = async (key: string): Promise<void> => {
  const response = await fetch(objectUrl(key), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${config().token}` },
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(
      `Could not delete ${key}: ${response.status} ${await response.text()}`,
    );
  }
};

/**
 * Runs `work` over `items`, `limit` at a time.
 *
 * A built site is thirty-odd files and firing all of them at once is both
 * rude to the API and a good way to turn one rate-limited response into a
 * failed publish. Sequential would be a round trip each, which for a site
 * being rebuilt while somebody waits is the difference between seconds and a
 * minute.
 */
export const inBatches = async <T>(
  items: T[],
  limit: number,
  work: (item: T) => Promise<void>,
): Promise<void> => {
  for (let i = 0; i < items.length; i += limit) {
    await Promise.all(items.slice(i, i + limit).map(work));
  }
};
