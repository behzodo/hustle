/**
 * The name a site is published under.
 *
 * This is a DNS label before it is anything else — it becomes the leftmost
 * part of `<slug>.korvians.online` — so it is bound by what a hostname is
 * allowed to be, not by what looks tidy: lowercase, letters digits and
 * hyphens, no leading or trailing hyphen, 63 characters at the outside.
 *
 * A slug is claimed once and then never changes. That is the whole point of
 * publishing: the link goes to a client, and a link that moves is worse than
 * no link at all. Everything here is about picking one that will still be
 * defensible in a year.
 */

/** The longest a single DNS label may be. */
const MAX_LABEL = 63;

/**
 * Names that must never be handed to a generated site.
 *
 * Two kinds, and they fail differently. The first is anything already spoken
 * for in this zone — `app` is the Next.js app on Vercel, `clerk` and its
 * neighbours are what sign-in runs through. Those have explicit DNS records
 * that beat the wildcard, so a site published there would not break them; it
 * would simply never load, which is worse, because nothing would look wrong
 * until a client said the link was dead.
 *
 * The second is the set a person would assume means something official —
 * `admin`, `support`, `billing`. A stranger's marketing site answering on
 * those is not a name clash, it is a phishing surface.
 */
const RESERVED = new Set([
  // Spoken for in the zone today.
  "www",
  "app",
  "clerk",
  "accounts",
  "clkmail",
  // Kept back for us.
  "api",
  "admin",
  "assets",
  "billing",
  "blog",
  "cdn",
  "dashboard",
  "dev",
  "docs",
  "help",
  "hello",
  "localhost",
  "mail",
  "preview",
  "sandbox",
  "shop",
  "staging",
  "static",
  "status",
  "support",
  "test",
]);

export const isReserved = (slug: string) => RESERVED.has(slug);

/**
 * A business name, reduced to something that can be a hostname.
 *
 *   "Joe's Gym & Fitness"  ->  "joes-gym-fitness"
 *   "Café Nero"            ->  "cafe-nero"
 *
 * The accent-stripping matters more than it looks. Half the trades we sweep
 * are family names, and a hostname cannot carry a diaeresis — without the
 * normalise step "Café" loses the whole word rather than the accent.
 */
export const slugify = (name: string): string =>
  name
    .normalize("NFKD")
    // Combining marks, left behind by the decomposition above.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    // An apostrophe joins rather than separates: "joe's" is one word, and
    // "joe-s" reads as two. Dropped before the general rule below turns every
    // other punctuation mark into a boundary.
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_LABEL)
    // The slice can land on a hyphen, which is not a legal label ending.
    .replace(/-+$/, "");

/**
 * A short, stable tag derived from the project id.
 *
 * Used only to break a tie — two barbers called Fade in the same city are not
 * a rare event. Derived from the id rather than a counter so that claiming a
 * slug needs no coordination and repeats the same answer if it runs twice.
 */
const tag = (projectId: string) => {
  let hash = 2166136261;

  for (let i = 0; i < projectId.length; i++) {
    hash ^= projectId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36).slice(0, 4);
};

/**
 * What this project would like to be called, in order of preference.
 *
 * The caller walks this list and takes the first name no other project holds.
 * It is a list rather than a single answer because the check happens in the
 * database, and the alternative — asking, being refused, asking again — is a
 * round trip per attempt for a collision that resolves on the second try.
 */
export const slugCandidates = (name: string, projectId: string): string[] => {
  const base = slugify(name);

  // Nothing survived: a name that was entirely punctuation, or entirely
  // script this cannot transliterate. The id alone is ugly but it resolves.
  if (!base) return [`site-${tag(projectId)}`];

  const suffixed = `${base.slice(0, MAX_LABEL - 5)}-${tag(projectId)}`;

  return isReserved(base) ? [suffixed] : [base, suffixed];
};
