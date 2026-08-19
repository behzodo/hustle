import "server-only";

/**
 * Finding an address to send the pitch to.
 *
 * This step exists because of a gap nothing upstream can close: a Google Maps
 * listing carries a phone number and never an email. The whole sweep, the
 * whole build, seventy-three finished websites — and no way to send any of
 * them to anybody. So the business has to be found a second time.
 *
 * The one thing working in our favour is that these are businesses with no
 * website, which by definition means they have somewhere else: a Facebook
 * page, a Linktree, a listing on a directory. That page is where a small
 * business puts its email, because it is the only place it has to put it.
 *
 * What this deliberately does not do is guess. `info@` at a domain nobody has
 * confirmed is a bounce at best and somebody else's inbox at worst, and a
 * cold email to a wrong address is how a sending domain gets burned. An
 * address is either read off a page they control or typed in by hand.
 */

/** A page that takes longer than this is a page we are not waiting for. */
const TIMEOUT_MS = 8000;

/** Beyond this the page is a bundle, and the address was in the first part. */
const MAX_BYTES = 600_000;

/**
 * Looks like a browser, because a plain fetch looks like a scraper.
 *
 * Not evasion — the pages here are public and this makes one request. It is
 * that a surprising number of small-business hosts return a challenge page to
 * anything without a UA string, and a challenge page has no email in it.
 */
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/**
 * Addresses that are on the page but are not the business.
 *
 * Every one of these was found by running this over real swept leads. The
 * image extensions matter more than they look: `logo@2x.png` matches any
 * naive email pattern, and a pitch addressed to it fails in a way nobody
 * notices until they wonder why a whole batch got no replies.
 */
const JUNK =
  /(^|@)(noreply|no-reply|donotreply|do-not-reply|postmaster|abuse|mailer-daemon)|@(example|test|localhost|sentry|wixpress|sentry\.io|godaddy|squarespace|domain)\.|\.(png|jpe?g|gif|webp|svg|css|js|woff2?)$|@\d+x\./i;

/**
 * The pattern, deliberately stricter than the RFC.
 *
 * A real address is allowed far more than this. But this runs over raw HTML
 * where anything can sit next to anything, and a permissive pattern there
 * pulls in half a minified script. The TLD floor of two letters and the ban on
 * a leading dot are what stop `v1.2@3.4` from being read as a contact.
 */
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9][a-z0-9.-]*\.[a-z]{2,}/gi;

/** Where an email lives when it is not on the front page. */
const CONTACT_PATHS = ["/contact", "/contact-us", "/about"];

export interface FoundEmail {
  email: string;
  /** Which page it came off — "social", "website", or "manual". */
  source: string;
}

const fetchText = async (url: string): Promise<string | null> => {
  const stop = AbortSignal.timeout(TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html,*/*" },
      signal: stop,
      redirect: "follow",
    });

    if (!res.ok) return null;

    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html") && !type.includes("text")) return null;

    // Read the head of the document rather than all of it. An email that is
    // 600 KB into a page is inside a script, and the ones worth having are in
    // the markup near the top.
    const body = await res.text();

    return body.slice(0, MAX_BYTES);
  } catch {
    // A dead link, a certificate a business let expire, a host that hangs up.
    // All of them mean the same thing here: no address on this page.
    return null;
  }
};

/**
 * Pulls the likeliest address out of a page.
 *
 * `mailto:` links come first because they are an intention rather than a
 * coincidence — somebody put that there for people to write to. Only if there
 * is none does this fall back to loose text, which is where the false
 * positives live.
 */
export const emailFromHtml = (html: string, host?: string): string | null => {
  const seen = new Set<string>();
  const add = (raw: string) => {
    const email = raw.toLowerCase().replace(/\.$/, "");
    if (!JUNK.test(email)) seen.add(email);
  };

  for (const match of html.matchAll(/mailto:([^"'?>\s]+)/gi)) add(match[1]);

  const linked = [...seen];

  for (const match of html.matchAll(EMAIL)) add(match[0]);

  const all = [...seen];
  if (all.length === 0) return null;

  // An address at the same domain as the page it was found on belongs to the
  // business. One at a different domain might be their web designer's, or a
  // partner's, or a widget vendor's — worth taking, but only second.
  const own = host ? all.filter((e) => host.endsWith(e.split("@")[1])) : [];

  return own[0] ?? linked[0] ?? all[0];
};

/**
 * Facebook, which is where most of these businesses actually are.
 *
 * The desktop site is a login wall to anything without a session. The old
 * mobile host still renders a page, and a business page's About section on it
 * is plain HTML — so the address, when they have published one, is readable.
 * Worth one extra request given how many leads are `presence: "social"`.
 */
const facebookVariants = (url: URL): string[] => {
  if (!/(^|\.)facebook\.com$/.test(url.hostname)) return [];

  const path = url.pathname.replace(/\/$/, "");

  return [
    `https://mbasic.facebook.com${path}/about`,
    `https://mbasic.facebook.com${path}`,
  ];
};

/**
 * Goes looking for one business's email.
 *
 * Returns null rather than throwing on every failure mode, because "we could
 * not find one" is the ordinary outcome and not an error: most small
 * businesses with no website have no published address either. The caller
 * records the attempt so it is not repeated.
 */
export const findEmail = async (lead: {
  website?: string;
  presence?: string;
}): Promise<FoundEmail | null> => {
  const raw = lead.website;
  if (!raw) return null;

  let url: URL;

  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const source = lead.presence === "social" ? "social" : "website";
  const facebook = facebookVariants(url);

  // The front page, then the pages an email is normally on. Stops at the first
  // hit — a business with a contact page has one address, not three.
  const pages = facebook.length
    ? facebook
    : [url.toString(), ...CONTACT_PATHS.map((path) => new URL(path, url).toString())];

  for (const page of pages) {
    const html = await fetchText(page);
    if (!html) continue;

    const email = emailFromHtml(html, url.hostname);
    if (email) return { email, source };
  }

  return null;
};
