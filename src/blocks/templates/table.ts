import { attr, esc, map, telHref, url, when, whenAny } from "../html";
import type { SiteContent, Template } from "../types";

/**
 * table — cafés, bakeries, restaurants, takeaways.
 *
 * Two things get looked up about a place that serves food, and neither is the
 * story of the owner's grandmother: what is on, and whether it is open. So the
 * list and the hours are the page, and the hours are given a panel of their
 * own rather than a line in the footer.
 *
 * The signature is the leader dots. A row of dots running from a dish to its
 * description is what a printed menu does and what nothing else does, and it
 * is the one detail that makes the page read as a menu before it is read at
 * all. It collapses on a narrow screen, where a dotted line between two
 * stacked lines of text would join nothing to nothing.
 *
 * Warm paper rather than a dark room: this is the trade that gets morning
 * light, and it is the one place in the set where cream is the honest answer
 * instead of the default one.
 */

const CSS = `
:root {
  --ground: #fbf5ea;
  --ink: #2b1d14;
  --muted: #6f5a49;
  --line: rgba(43, 29, 20, 0.16);
  --accent: #b3450e;
  --on-accent: #fbf5ea;
  --display: "Iowan Old Style", Georgia, "Times New Roman", serif;
  --body: "Segoe UI", system-ui, -apple-system, sans-serif;
}

.label {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--accent);
}

.hero { position: relative; min-height: min(78vh, 42rem); display: grid; align-items: end; overflow: hidden; }
.hero .shot { position: absolute; inset: 0; background-size: cover; background-position: center; filter: saturate(1.05); }
.hero .shot::after {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(43,29,20,0.25) 0%, rgba(43,29,20,0.55) 55%, var(--ground) 100%);
}
.hero.bare { min-height: auto; padding-top: clamp(3rem, 8vw, 6rem); }
.hero .inner { position: relative; padding-block: clamp(2.5rem, 7vw, 5rem); }
.hero.shot-on .inner { color: #fdf8f1; }
.hero.shot-on .label { color: #f2c9a8; }

.hero h1 {
  font-family: var(--display);
  font-size: clamp(2.5rem, 8vw, 5.5rem);
  font-weight: 400;
  line-height: 1;
  letter-spacing: -0.02em;
  margin-block: 0.75rem 0;
}
.hero .sub { margin-top: 1.25rem; max-width: 44ch; font-size: 1.0625rem; }
.hero.shot-on .sub { color: rgba(253, 248, 241, 0.86); }
.hero .sub { color: var(--muted); }

.act {
  display: inline-block;
  margin-top: 1.75rem;
  padding: 0.9375rem 2rem;
  background: var(--accent);
  color: var(--on-accent);
  text-decoration: none;
  font-weight: 700;
  letter-spacing: 0.04em;
  font-size: 0.9375rem;
  transition: transform 0.18s ease, filter 0.18s ease;
}
.act:hover { transform: translateY(-2px); filter: brightness(1.08); }

/* The menu. The dotted run is a flex filler between the name and the note, so
   it stretches to whatever is left rather than being a fixed string of
   periods that wraps. */
.dishes { border-top: 2px solid var(--ink); margin-top: 2rem; }
.dishes li { padding-block: 1.125rem; border-bottom: 1px solid var(--line); }
.dishes .row { display: flex; align-items: baseline; gap: 0.75rem; }
.dishes h3 { font-family: var(--display); font-size: 1.3125rem; font-weight: 400; white-space: nowrap; }
.dishes .lead { flex: 1 1 auto; border-bottom: 2px dotted var(--line); transform: translateY(-0.3rem); min-width: 1.5rem; }
.dishes p { color: var(--muted); font-size: 0.9375rem; text-align: right; max-width: 30rem; }
@media (max-width: 44rem) {
  .dishes .row { display: block; }
  .dishes .lead { display: none; }
  .dishes p { text-align: left; margin-top: 0.375rem; max-width: none; }
}

.about p { font-family: var(--display); font-size: clamp(1.25rem, 1.1rem + 0.85vw, 1.875rem); line-height: 1.45; margin-top: 1.25rem; }

/* Hours get a panel because they are the most-asked question in the trade and
   a line in a footer is where a question goes to be missed. */
.open { background: var(--ink); color: var(--ground); border-radius: 0.25rem; padding: clamp(1.75rem, 4vw, 2.75rem); }
.open h2 { font-family: var(--display); font-size: 1.75rem; font-weight: 400; }
.open ul { margin-top: 1.25rem; column-width: 14rem; column-gap: 2.5rem; }
.open li { display: flex; justify-content: space-between; gap: 1rem; padding-block: 0.4375rem; border-bottom: 1px solid rgba(251, 245, 234, 0.16); font-variant-numeric: tabular-nums; }

.quotes { display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr)); margin-top: 2rem; }
.quotes blockquote { margin: 0; padding-left: 1.25rem; border-left: 3px solid var(--accent); }
.quotes p { font-family: var(--display); font-size: 1.125rem; line-height: 1.5; }
.quotes cite { display: block; margin-top: 0.75rem; font-style: normal; font-size: 0.8125rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }

.visit { display: grid; gap: var(--gutter); grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); }
.visit h3 { font-size: 0.6875rem; letter-spacing: 0.22em; text-transform: uppercase; color: var(--accent); font-weight: 700; }
.visit p { margin-top: 0.875rem; }

footer { border-top: 2px solid var(--ink); padding-block: 2.5rem 3.5rem; }
footer .name { font-family: var(--display); font-size: 1.375rem; }
footer .fine { margin-top: 0.5rem; font-size: 0.875rem; color: var(--muted); }
`;

const render = ({ business, copy }: SiteContent) => {
  // Split "Mon–Fri  8am – 6pm" into its two columns where a separator is
  // present, so the panel reads as a timetable. A line that does not split is
  // shown whole rather than guessed at.
  const hours = (business.hours ?? []).map((line) => {
    const at = line.search(/\s{2,}|\t|:\s/);
    return at === -1
      ? { day: line, time: "" }
      : { day: line.slice(0, at).replace(/:$/, ""), time: line.slice(at).trim() };
  });

  const shot = Boolean(business.photo);

  const html = `
<a class="skip" href="#main">Skip to content</a>
<header class="hero ${shot ? "shot-on" : "bare"}">
  ${when(business.photo, (photo) => `<div class="shot" style="background-image:url('${url(photo)}')"></div>`)}
  <div class="inner wrap">
    <p class="label">${esc([business.trade, business.town].filter(Boolean).join(" · "))}</p>
    <h1>${esc(copy.headline)}</h1>
    ${when(copy.subhead, (sub) => `<p class="sub">${esc(sub)}</p>`)}
    ${when(
      business.phone,
      (phone) => `<a class="act" href="${telHref(phone)}">${esc(copy.ctaLabel || "Book a table")}</a>`,
    )}
  </div>
</header>

<main id="main">
  ${whenAny(
    copy.services,
    (services) => `
  <section class="wrap section reveal">
    <h2 class="label">What we serve</h2>
    <ul class="dishes">
      ${map(
        services,
        (service) => `
      <li>
        <div class="row">
          <h3>${esc(service.name)}</h3>
          ${when(service.blurb, () => `<span class="lead" aria-hidden="true"></span>`)}
          ${when(service.blurb, (blurb) => `<p>${esc(blurb)}</p>`)}
        </div>
      </li>`,
      )}
    </ul>
  </section>`,
  )}

  ${when(
    copy.about,
    (about) => `
  <section class="wrap section about reveal">
    <h2 class="label">The place</h2>
    <div class="prose"><p>${esc(about)}</p></div>
  </section>`,
  )}

  ${whenAny(
    hours,
    (rows) => `
  <section class="wrap section reveal">
    <div class="open">
      <h2>When we're open</h2>
      <ul>
        ${map(rows, (row) => `<li><span>${esc(row.day)}</span><span>${esc(row.time)}</span></li>`)}
      </ul>
    </div>
  </section>`,
  )}

  ${whenAny(
    copy.reviews,
    (reviews) => `
  <section class="wrap section reveal">
    <h2 class="label">Regulars</h2>
    <div class="quotes">
      ${map(
        reviews,
        (review) => `
      <blockquote>
        <p>${esc(review.text)}</p>
        ${when(review.author, (author) => `<cite>${esc(author)}</cite>`)}
      </blockquote>`,
      )}
    </div>
  </section>`,
  )}

  <section class="wrap section reveal">
    <h2 class="sr">Find us</h2>
    <div class="visit">
      ${when(
        business.phone,
        (phone) => `
      <div>
        <h3>Call</h3>
        <p><a href="${telHref(phone)}">${esc(phone)}</a></p>
        ${when(business.email, (email) => `<p><a href="mailto:${attr(email)}">${esc(email)}</a></p>`)}
      </div>`,
      )}
      ${when(
        business.address,
        (address) => `
      <div>
        <h3>Where</h3>
        <p>${esc(address)}</p>
        ${when(business.mapsUrl, (maps) => `<p><a href="${url(maps)}" rel="noopener">Open in maps</a></p>`)}
      </div>`,
      )}
      ${when(
        business.rating,
        (rating) => `
      <div>
        <h3>Rated</h3>
        <p>${esc(rating.toFixed(1))} out of 5${when(business.reviewCount, (count) => ` · ${esc(count)} reviews`)}</p>
      </div>`,
      )}
    </div>
  </section>
</main>

<footer class="wrap">
  <p class="name">${esc(business.name)}</p>
  ${when(copy.closing, (closing) => `<p class="fine">${esc(closing)}</p>`)}
</footer>`;

  return { html, css: CSS };
};

export const table: Template = {
  name: "table",
  description: "Cafés and restaurants. Warm paper, menu leader dots, hours given a panel.",
  render,
};
