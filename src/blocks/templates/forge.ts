import { esc, map, telHref, url, when, whenAny } from "../html";
import type { SiteContent, Template } from "../types";

/**
 * forge — gyms, boxing clubs, barbers, garages, tattoo studios.
 *
 * Rooms with low light, hard surfaces and someone working. Dark, then, but
 * dark is also where every generated page ends up by default, so the shape has
 * to come from somewhere other than the background: a condensed uppercase
 * display face set tight, hairline rules doing the dividing, and one hot
 * orange borrowed off heated steel that appears on the button and nowhere
 * else.
 *
 * The signature is the stat row. A gym's proof is a number — years open,
 * members, weight on the rack — and those are set larger than the headline,
 * tabular, stacked like plates. When there are no numbers to show the row is
 * not rendered, because an invented statistic is the one thing on a page that
 * can lose somebody the client.
 */

const CSS = `
:root {
  --ground: #14151a;
  --ink: #ece8e1;
  --muted: #9a968f;
  --line: rgba(236, 232, 225, 0.16);
  --accent: #f0522b;
  --on-accent: #14151a;
  --display: "Helvetica Neue", "Arial Narrow", Helvetica, Arial, sans-serif;
  --body: "Helvetica Neue", Helvetica, Arial, sans-serif;
}

.label {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--muted);
}

/* The photo, when there is one. Darkened and desaturated rather than shown as
   found: a Google listing thumbnail is a snapshot in whatever light the day
   had, and the page has to hold together whether it arrived bright, dim or
   not at all. */
.hero { position: relative; display: grid; align-items: end; min-height: min(86vh, 46rem); overflow: hidden; }
.hero .shot {
  position: absolute; inset: 0;
  background-size: cover; background-position: center;
  filter: grayscale(0.55) contrast(1.05) brightness(0.42);
}
.hero .shot::after {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(20,21,26,0.45) 0%, rgba(20,21,26,0.2) 40%, var(--ground) 100%);
}
.hero .inner { position: relative; padding-block: clamp(3rem, 8vw, 6rem); }

.hero h1 {
  font-size: clamp(2.75rem, 11vw, 7.5rem);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: -0.035em;
  margin-block: 0.5rem;
}

.hero .sub { color: var(--muted); max-width: 44ch; margin-top: 1.25rem; font-size: 1.0625rem; }

.act {
  display: inline-block;
  margin-top: 2rem;
  padding: 1rem 2rem;
  background: var(--accent);
  color: var(--on-accent);
  text-decoration: none;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-size: 0.9375rem;
  transition: transform 0.18s ease, filter 0.18s ease;
}
.act:hover { transform: translateY(-2px); filter: brightness(1.08); }

/* The stat row: plates on a bar. Tabular so the digits line up column to
   column, and a top rule per item rather than a box, because a box makes three
   numbers look like three cards. */
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); gap: 1px; background: var(--line); border-block: 1px solid var(--line); }
.stats div { background: var(--ground); padding: clamp(1.5rem, 4vw, 2.5rem) 1.25rem; }
.stats b {
  display: block;
  font-family: var(--display);
  font-size: clamp(2.25rem, 6vw, 3.75rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.stats span { display: block; margin-top: 0.625rem; }

.rig { border-top: 1px solid var(--line); }
.rig li { padding-block: 1.75rem; border-bottom: 1px solid var(--line); display: grid; grid-template-columns: minmax(0, 20rem) minmax(0, 1fr); gap: 0.375rem 2rem; }
.rig h3 { font-size: 1.25rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.01em; }
.rig p { color: var(--muted); }
@media (max-width: 46rem) { .rig li { grid-template-columns: 1fr; } }

.about p { font-size: clamp(1.25rem, 1.1rem + 0.9vw, 1.875rem); line-height: 1.35; font-weight: 500; letter-spacing: -0.015em; margin-top: 1.5rem; }

.quotes { display: grid; gap: 1.75rem; grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr)); margin-top: 2rem; }
.quotes blockquote { margin: 0; border-top: 3px solid var(--accent); padding-top: 1.25rem; }
.quotes cite { display: block; margin-top: 0.875rem; font-style: normal; color: var(--muted); font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.12em; }

.visit { display: grid; gap: var(--gutter); grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); }
.visit h3 { font-size: 0.6875rem; letter-spacing: 0.24em; text-transform: uppercase; color: var(--muted); font-weight: 700; }
.visit ul, .visit p { margin-top: 0.875rem; }
.visit li { padding-block: 0.25rem; font-variant-numeric: tabular-nums; }

footer { border-top: 1px solid var(--line); padding-block: 2.5rem 3.5rem; }
footer .fine { margin-top: 0.5rem; font-size: 0.875rem; color: var(--muted); }
`;

const render = ({ business, copy }: SiteContent) => {
  // Only what is actually known. A gym with no rating and no review count
  // renders no stat row at all rather than a row of dashes.
  const stats: { value: string; label: string }[] = [];

  if (business.rating !== undefined) {
    stats.push({ value: business.rating.toFixed(1), label: "Rated out of 5" });
  }
  if (business.reviewCount !== undefined) {
    stats.push({ value: String(business.reviewCount), label: "Reviews" });
  }
  if (copy.services.length > 0) {
    stats.push({ value: String(copy.services.length), label: "Ways in" });
  }

  const html = `
<a class="skip" href="#main">Skip to content</a>
<header class="hero">
  ${when(business.photo, (photo) => `<div class="shot" style="background-image:url('${url(photo)}')"></div>`)}
  <div class="inner wrap">
    <p class="label">${esc([business.trade, business.town].filter(Boolean).join(" / "))}</p>
    <h1>${esc(copy.headline)}</h1>
    ${when(copy.subhead, (sub) => `<p class="sub">${esc(sub)}</p>`)}
    ${when(
      business.phone,
      (phone) =>
        `<a class="act" href="${telHref(phone)}">${esc(copy.ctaLabel || "Call the gym")}</a>`,
    )}
  </div>
</header>

<main id="main">
  ${whenAny(
    stats,
    (rows) => `
  <section>
    <h2 class="sr">By the numbers</h2>
    <div class="stats">
      ${map(rows, (row) => `<div><b>${esc(row.value)}</b><span class="label">${esc(row.label)}</span></div>`)}
    </div>
  </section>`,
  )}

  ${whenAny(
    copy.services,
    (services) => `
  <section class="wrap section reveal">
    <h2 class="label">Training</h2>
    <ul class="rig">
      ${map(
        services,
        (service) => `
      <li>
        <h3>${esc(service.name)}</h3>
        ${when(service.blurb, (blurb) => `<p>${esc(blurb)}</p>`)}
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
    copy.reviews,
    (reviews) => `
  <section class="wrap section reveal">
    <h2 class="label">Members</h2>
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
      ${whenAny(
        business.hours,
        (hours) => `
      <div>
        <h3>Open</h3>
        <ul>${map(hours, (line) => `<li>${esc(line)}</li>`)}</ul>
      </div>`,
      )}
    </div>
  </section>
</main>

<footer class="wrap">
  <p class="label">${esc(business.name)}</p>
  ${when(copy.closing, (closing) => `<p class="fine">${esc(closing)}</p>`)}
</footer>`;

  return { html, css: CSS };
};

export const forge: Template = {
  name: "forge",
  description: "Gyms, barbers, garages. Dark, condensed, one hot accent, stats as plates.",
  render,
};
