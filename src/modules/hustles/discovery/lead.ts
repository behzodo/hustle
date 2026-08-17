/**
 * Reading a Google Maps listing and deciding whether it is worth pitching.
 *
 * The whole product rests on one question — does this business have a real
 * website? — and Maps answers it badly. A listing with no `website` at all is
 * the obvious yes, but a large share of the best prospects link something that
 * is not a website: a Facebook page, a Linktree, a Yelp entry, one of Google's
 * own auto-generated `business.site` pages. Those are the warmest leads there
 * are. They have already decided they need to be findable and settled for a
 * page they do not own, so treating them as "has a website" would throw away
 * the good half of the list.
 *
 * Relative imports for the same reason as ./plan.ts — Convex bundles this.
 */

/** What the business is currently using instead of a site, if anything. */
export type SocialKind =
  | "facebook"
  | "instagram"
  | "tiktok"
  | "x"
  | "linkedin"
  | "youtube"
  | "yelp"
  | "linktree"
  | "google-site"
  | "ordering"
  | "booking";

/**
 * `none`    — nothing at all. The cleanest pitch.
 * `social`  — a page on someone else's platform. Still a target.
 * `site`    — their own domain. Not a target.
 * `unknown` — nobody recorded one, which is not the same as not having one.
 *             Only OpenStreetMap produces this; see convex/lib/places/overpass.ts.
 */
export type WebPresence = "none" | "social" | "site" | "unknown";

/**
 * Hosts that are somebody else's platform, not the business's website.
 *
 * Matched on the registrable tail so `m.facebook.com` and `www.facebook.com`
 * both land, without a wildcard that would also catch `facebook.mybakery.com`.
 */
const PLATFORMS: [suffix: string, kind: SocialKind][] = [
  ["facebook.com", "facebook"],
  ["fb.com", "facebook"],
  ["fb.me", "facebook"],
  ["instagram.com", "instagram"],
  ["instagr.am", "instagram"],
  ["tiktok.com", "tiktok"],
  ["twitter.com", "x"],
  ["x.com", "x"],
  ["linkedin.com", "linkedin"],
  ["youtube.com", "youtube"],
  ["youtu.be", "youtube"],
  ["yelp.com", "yelp"],
  ["yelp.ca", "yelp"],
  ["linktr.ee", "linktree"],
  ["beacons.ai", "linktree"],
  ["bio.link", "linktree"],
  ["taplink.cc", "linktree"],
  // Google's own one-page site, generated from the Maps listing itself. A
  // business linking this has no website — it has a formatted copy of the
  // listing we are already reading.
  ["business.site", "google-site"],
  ["sites.google.com", "google-site"],
  ["google.com", "google-site"],
  // Ordering and booking portals. The customer never reaches anything the
  // business controls, which is exactly the gap being sold.
  ["doordash.com", "ordering"],
  ["ubereats.com", "ordering"],
  ["grubhub.com", "ordering"],
  ["opentable.com", "ordering"],
  ["toasttab.com", "ordering"],
  ["order.online", "ordering"],
  ["clover.com", "ordering"],
  // Appointment books. A salon whose only link is its Setmore page has a
  // booking form, not a website — this turned up in the first real Miami
  // sweep, where "wynwoodsalon.setmore.com" was being counted as a site.
  ["setmore.com", "booking"],
  ["booker.com", "booking"],
  ["booksy.com", "booking"],
  ["vagaro.com", "booking"],
  ["fresha.com", "booking"],
  ["schedulicity.com", "booking"],
  ["acuityscheduling.com", "booking"],
  ["squareup.com", "booking"],
  ["mindbodyonline.com", "booking"],
  ["simplybook.me", "booking"],
  ["calendly.com", "booking"],
  ["styleseat.com", "booking"],
];

const hostOf = (url: string) => {
  try {
    // Maps sometimes returns a bare domain with no scheme.
    const parsed = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
};

const matches = (host: string, suffix: string) =>
  host === suffix || host.endsWith(`.${suffix}`);

export interface WebVerdict {
  presence: WebPresence;
  /** The platform they settled for, when that is what the link was. */
  socialKind?: SocialKind;
  /** Normalised, scheme-included, or absent when there was nothing usable. */
  website?: string;
}

/**
 * What the listing's `website` field actually amounts to.
 *
 * `known` is whether an empty field is evidence. On a Google listing it is:
 * the field exists and the owner left it blank. On an OpenStreetMap feature
 * it is not — the tag is only there if a volunteer added it, so a blank one
 * is a gap in the map rather than a gap in the market, and calling it "no
 * website" would send someone to pitch a business that already has one.
 */
export const readWebsite = (
  website?: string | null,
  known = true,
): WebVerdict => {
  const raw = website?.trim();
  if (!raw) return { presence: known ? "none" : "unknown" };

  const host = hostOf(raw);
  if (host === null) return { presence: known ? "none" : "unknown" };

  const platform = PLATFORMS.find(([suffix]) => matches(host, suffix));

  if (platform) {
    return { presence: "social", socialKind: platform[1], website: raw };
  }

  return { presence: "site", website: raw };
};

export interface ScoreInput {
  presence: WebPresence;
  /** Total Google reviews, when the listing had any. */
  reviewCount?: number;
  rating?: number;
  hasPhone: boolean;
}

/**
 * How worth pitching this one is, 0–100.
 *
 * Three things move it, in the order they matter:
 *
 *  - The gap. No website is the entire premise, so it carries the most.
 *  - Proof the business is real and trading. A listing with two hundred
 *    reviews is a going concern with money; one with none may be closed, a
 *    duplicate, or somebody's registered address. Reviews are counted on a log
 *    scale because the step from 0 to 20 says far more than 200 to 400.
 *  - Reachability. A listing with no phone number is hard to follow up on
 *    when the email lands nowhere.
 *
 * Rating deliberately counts for little: a well-reviewed business is a nicer
 * client, but a three-star plumber with no website still needs one.
 */
export const scoreLead = ({ presence, reviewCount, rating, hasPhone }: ScoreInput) => {
  // A business with its own site is not a prospect at any review count, and
  // the list that shows everything sorts by this — so it scores nothing rather
  // than out-ranking a real lead on traction alone.
  if (presence === "site") return 0;

  // An unrecorded website is worth less than a confirmed gap and more than
  // nothing: it is a business to check, not a business to pitch.
  const gap = presence === "none" ? 55 : presence === "social" ? 40 : 22;
  const traction = Math.min(30, Math.round(Math.log10(1 + (reviewCount ?? 0)) * 14));
  const standing = rating !== undefined && rating >= 4 ? 10 : 0;
  const reachable = hasPhone ? 5 : 0;

  return Math.max(0, Math.min(100, gap + traction + standing + reachable));
};

/** Only these are pitched. A business with its own domain is not a lead. */
export const isTarget = (presence: WebPresence) => presence !== "site";

const SOCIAL_LABELS: Record<SocialKind, string> = {
  facebook: "Facebook page only",
  instagram: "Instagram only",
  tiktok: "TikTok only",
  x: "X profile only",
  linkedin: "LinkedIn only",
  youtube: "YouTube only",
  yelp: "Yelp listing only",
  linktree: "Link-in-bio only",
  "google-site": "Auto-generated Google page",
  ordering: "Ordering portal only",
  booking: "Booking page only",
};

/**
 * The one-line reason this business is on the list.
 *
 * `socialKind` is typed loosely because it comes back off a stored row as a
 * plain string — the database keeps the slug, not the union.
 */
export const describeGap = (presence: WebPresence, socialKind?: string) => {
  if (presence === "none") return "No website";
  if (presence === "site") return "Has a website";
  // Deliberately not "no website": this one has not been checked, and saying
  // otherwise is how someone ends up pitching a business that already has one.
  if (presence === "unknown") return "Website not listed";

  const label = socialKind ? SOCIAL_LABELS[socialKind as SocialKind] : undefined;
  return label ?? "No website of their own";
};
