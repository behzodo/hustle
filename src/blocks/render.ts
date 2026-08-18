import type { BuiltFile } from "@/workshop";

import { BASE_CSS, REVEAL_JS } from "./base";
import { attr, esc, safeUrl, tighten, tightenCss, url } from "./html";
import { TEMPLATES, templateFor } from "./templates";
import type { SiteContent, TemplateName } from "./types";

/**
 * Turning content into a site.
 *
 * The output is one file. Not a bundle, not a build — a single index.html with
 * its stylesheet and its four lines of script inside it, plus a robots.txt and
 * a sitemap so the page can be found.
 *
 * That is the whole reason the fast lane is fast. A React build needs a
 * machine to run on, and a machine takes a minute to get and three to use;
 * this needs a string. It also makes the site itself quick in a way that
 * matters for who is looking at it — a plumber's customer is on a phone at the
 * side of a road, and one request that carries everything beats four that
 * arrive in sequence.
 *
 * When a client replies and wants something this cannot do, that is when the
 * slow lane opens a sandbox and builds properly. Until then nothing here needs
 * one.
 */

/** Where the model's sentences end for the purposes of a meta description. */
const META_MAX = 155;

const describe = ({ copy }: SiteContent) => {
  const source = copy.subhead || copy.about || copy.headline;
  const text = source.replace(/\s+/g, " ").trim();

  if (text.length <= META_MAX) return text;

  // Cut on a word so the summary in a search result does not end mid-word.
  const cut = text.slice(0, META_MAX);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
};

/**
 * A favicon, drawn rather than fetched.
 *
 * The business's initial on its template's accent. Inline as a data URI
 * because the alternative is a second request for a 16-pixel square, and
 * because a site with no favicon shows a browser's blank page icon in a tab
 * next to whatever the client already has open.
 */
const favicon = (initial: string, accent: string) => {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" rx="12" fill="${accent}"/>` +
    `<text x="50%" y="52%" dy=".35em" text-anchor="middle" ` +
    `font-family="Helvetica,Arial,sans-serif" font-size="34" font-weight="700" ` +
    `fill="#fff">${esc(initial)}</text></svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

/** The accent each template paints with, for the favicon and theme colour. */
const ACCENTS: Record<TemplateName, string> = {
  forge: "#f0522b",
  bloom: "#b47f86",
  plumbline: "#101828",
  table: "#b3450e",
};

/**
 * Structured data, so a search engine knows this is a business and not a blog.
 *
 * Only fields we actually hold. Schema.org will happily accept an empty
 * address or a rating of zero, and both are worse than the absence — a wrong
 * opening time in a search result sends somebody to a locked door and the
 * client hears about it, not us.
 */
const structuredData = (content: SiteContent, siteUrl: string) => {
  const { business } = content;

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: business.name,
    description: describe(content),
    url: siteUrl,
  };

  // Through the same scheme check the markup uses. A javascript: URL is not
  // executable sitting in a JSON-LD block, but this is content a model wrote
  // about a business a scraper found, and the answer to "can this be a link"
  // should not depend on which element it lands in.
  const photo = safeUrl(business.photo);
  const maps = safeUrl(business.mapsUrl);

  if (business.phone) data.telephone = business.phone;
  if (business.address) data.address = { "@type": "PostalAddress", streetAddress: business.address };
  if (photo) data.image = photo;
  if (maps) data.hasMap = maps;

  if (business.rating !== undefined && business.reviewCount !== undefined) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: business.rating,
      reviewCount: business.reviewCount,
    };
  }

  // A closing brace inside a script element ends the element, whatever the
  // JSON thinks. The escape has to happen after serialising.
  return JSON.stringify(data).replace(/</g, "\\u003c");
};

export interface RenderOptions {
  /** Overrides the template the trade would have chosen. */
  template?: TemplateName;
  /** Where the site will live, for canonical and og:url. */
  siteUrl?: string;
}

export interface RenderedFiles {
  files: BuiltFile[];
  template: TemplateName;
  bytes: number;
}

export const renderSite = (
  content: SiteContent,
  options: RenderOptions = {},
): RenderedFiles => {
  const { business } = content;

  const name = options.template ?? templateFor(business.trade);
  const template = TEMPLATES[name];
  const { html, css } = template.render(content);

  const siteUrl = options.siteUrl ?? "";
  const description = describe(content);
  const title = business.town
    ? `${business.name} — ${business.trade} in ${business.town}`
    : `${business.name} — ${business.trade}`;

  const head = [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width,initial-scale=1">`,
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${attr(description)}">`,
    `<meta name="theme-color" content="${ACCENTS[name]}">`,
    siteUrl ? `<link rel="canonical" href="${url(siteUrl)}">` : "",
    `<link rel="icon" href="${favicon(business.name.trim().charAt(0).toUpperCase() || "•", ACCENTS[name])}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${attr(title)}">`,
    `<meta property="og:description" content="${attr(description)}">`,
    siteUrl ? `<meta property="og:url" content="${url(siteUrl)}">` : "",
    business.photo ? `<meta property="og:image" content="${url(business.photo)}">` : "",
    `<meta name="twitter:card" content="${business.photo ? "summary_large_image" : "summary"}">`,
    `<style>${tightenCss(BASE_CSS + css)}</style>`,
  ]
    .filter(Boolean)
    .join("");

  const document =
    `<!doctype html><html lang="en"><head>${head}</head><body>` +
    `${tighten(html)}` +
    `<script type="application/ld+json">${structuredData(content, siteUrl)}</script>` +
    `<script>${REVEAL_JS.replace(/\s*\n\s*/g, " ").trim()}</script>` +
    `</body></html>`;

  const files: BuiltFile[] = [
    { path: "index.html", bytes: Buffer.from(document, "utf8") },
    {
      path: "robots.txt",
      bytes: Buffer.from(
        siteUrl
          ? `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`
          : `User-agent: *\nAllow: /\n`,
        "utf8",
      ),
    },
  ];

  if (siteUrl) {
    files.push({
      path: "sitemap.xml",
      bytes: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8"?>` +
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
          `<url><loc>${esc(siteUrl)}/</loc></url></urlset>`,
        "utf8",
      ),
    });
  }

  return {
    files,
    template: name,
    bytes: files.reduce((total, file) => total + file.bytes.length, 0),
  };
};

export { TEMPLATES, TEMPLATE_NAMES, USES_PHOTO, templateFor } from "./templates";
export type { SiteContent, TemplateName } from "./types";
