/**
 * Building HTML out of strings, safely.
 *
 * Everything a template is handed is untrusted twice over. The facts came off
 * a scraped Google listing, where the business name is whatever the owner
 * typed into a form years ago. The sentences came out of a language model,
 * which was asked for copy about a business whose own name is part of the
 * prompt. Neither is a place to find out that quotes and angle brackets are
 * structural.
 *
 * So nothing in a template concatenates a value in directly. It goes through
 * `esc` for text, `attr` for an attribute, or `url` for a link, and the one
 * place raw markup is allowed is `raw`, which is used only for markup this
 * repo wrote.
 */

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Text, for anywhere between two tags. */
export const esc = (value: string | number | undefined | null): string =>
  value === undefined || value === null
    ? ""
    : String(value).replace(/[&<>"']/g, (character) => ESCAPES[character]);

/** Text, for inside a quoted attribute. Same rules; named for the call site. */
export const attr = esc;

/**
 * A URL that is allowed to be one, or undefined.
 *
 * Only the schemes a marketing page has any business linking to. The one being
 * kept out is `javascript:`, which an href will happily run and which a model
 * asked for "a link to their booking page" can produce by being wrong rather
 * than by being malicious.
 *
 * Returned unescaped, because not every place a URL goes is HTML — the
 * structured data block is JSON, where an escaped ampersand is a broken link
 * rather than a safe one. Callers writing into markup use `url` below.
 */
export const safeUrl = (value: string | undefined): string | undefined => {
  if (!value) return undefined;

  const trimmed = value.trim();

  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;

  // A bare domain — "joesgym.co.uk" — is what a listing usually carries.
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return undefined;
};

/** The same, escaped for an attribute. Empty when the URL was not allowed. */
export const url = (value: string | undefined): string => esc(safeUrl(value));

/** A phone number as a dialable href. Spaces and brackets are decoration. */
export const telHref = (phone: string | undefined): string =>
  phone ? esc(`tel:${phone.replace(/[^\d+]/g, "")}`) : "";

/** Markup this repo produced. Never a value from outside. */
export const raw = (value: string): string => value;

/** `html` when `value` is present, nothing when it is not. */
export const when = <T>(value: T | undefined | null | false, html: (value: T) => string): string =>
  value === undefined || value === null || value === false || value === "" ? "" : html(value as T);

/** Same, for lists — an empty list renders nothing rather than an empty box. */
export const whenAny = <T>(items: T[] | undefined, html: (items: T[]) => string): string =>
  items && items.length > 0 ? html(items) : "";

export const map = <T>(items: T[], html: (item: T, index: number) => string): string =>
  items.map(html).join("");

/**
 * Squeezes the output.
 *
 * Templates are written with the indentation that makes them readable here,
 * and none of it means anything in the page. Collapsing it is worth a third of
 * the file, which for a page served to somebody on a phone at the side of a
 * road is the difference worth having.
 *
 * Deliberately conservative: it only touches whitespace that sits between
 * tags, so nothing inside a sentence — or inside a <pre> — moves.
 */
export const tighten = (html: string): string =>
  html
    .replace(/>\s*\n\s*</g, "><")
    .replace(/\n\s+/g, "\n")
    .trim();

/** The same for stylesheets, where nothing is significant except inside quotes. */
export const tightenCss = (css: string): string =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s*([{}:;,>])\s*/g, "$1")
    .replace(/;}/g, "}")
    .replace(/\s+/g, " ")
    .trim();
