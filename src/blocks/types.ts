/**
 * What a site is made of.
 *
 * This is the contract between the three things that never see each other: the
 * sweep, which knows facts about a business; the model, which writes sentences
 * about it; and a template, which turns both into a page. Everything below is
 * either a fact we found or a sentence somebody wrote — nothing here is
 * computed by a template, because a template that can invent content is a
 * template that can invent a phone number.
 *
 * Almost every field is optional, and that is the point. A lead is whatever
 * Google happened to list, which for a one-man plumber is often a name, a
 * number and nothing else. The rule the templates follow is that an absent
 * field removes its section rather than filling it — a page with three
 * sections that are all true beats a page with six where two are guesses.
 */

/** What we know. Gathered, not written. */
export interface BusinessFacts {
  name: string;
  /** The trade as a person would say it: "Plumber", "Hair salon". */
  trade: string;
  /** Where it is, as a person would say it: "Headingley, Leeds". */
  town?: string;
  phone?: string;
  email?: string;
  address?: string;
  /** A link to the listing on a map, for the "find us" line. */
  mapsUrl?: string;
  /** Google's star rating, 0–5. */
  rating?: number;
  reviewCount?: number;
  /** A photo of the place, from the listing. See leads.photo. */
  photo?: string;
  /** Opening times, one line each: "Mon–Fri  8am – 6pm". */
  hours?: string[];
}

/** One thing the business does. */
export interface Service {
  name: string;
  /** A sentence at most. Optional — a bare list is better than padding. */
  blurb?: string;
}

/** Something a customer said. Quoted, never written for them. */
export interface Review {
  text: string;
  author?: string;
  /** 1–5. */
  stars?: number;
}

/** What somebody wrote. This is the model's whole job. */
export interface SiteCopy {
  /** The one line at the top. Short — it is set very large. */
  headline: string;
  /** The line under it, which does the explaining. */
  subhead?: string;
  /** Two or three sentences. Who they are, how long, what they care about. */
  about?: string;
  services: Service[];
  /** What the main button says: "Call now", "Book a table". */
  ctaLabel?: string;
  reviews?: Review[];
  /** A closing line above the footer. */
  closing?: string;
}

export interface SiteContent {
  business: BusinessFacts;
  copy: SiteCopy;
}

/**
 * The four looks, and who each is for.
 *
 * Four rather than one because these sites are pitched down a street. Two shops
 * three doors apart comparing identical pages is not a near miss, it is the
 * whole pitch falling over — and four rather than forty because every one of
 * them has to be designed, and a template nobody tuned is worse than a template
 * somebody else's business already has.
 */
export type TemplateName = "forge" | "bloom" | "plumbline" | "table";

/** What a template hands back: one page and the stylesheet it needs. */
export interface RenderedSite {
  html: string;
  css: string;
}

export interface Template {
  name: TemplateName;
  /** One line, for whoever is choosing between them. */
  description: string;
  render: (content: SiteContent) => RenderedSite;
}
