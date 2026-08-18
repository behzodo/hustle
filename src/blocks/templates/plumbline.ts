import { attr, esc, map, telHref, url, when, whenAny } from "../html";
import type { SiteContent, Template } from "../types";

/**
 * plumbline — plumbers, electricians, roofers, builders, locksmiths.
 *
 * The thing a trade website is for is the phone ringing. Nobody reads a
 * bricklayer's About page; they have a leak, they find a number, they call it.
 * So the number is not in the header and it is not a button in the corner — it
 * is the largest thing on the page, set like the lettering on the side of a
 * van, and everything else is arranged underneath it.
 *
 * The world this borrows from is the paperwork rather than the pipe: a faint
 * drawing grid, ink navy, hairline rules, and hi-vis yellow used exactly once,
 * on the thing you are meant to press. Hi-vis is loud on purpose and stops
 * meaning anything the second it appears twice.
 */

const CSS = `
:root {
  --ground: #f3f4f1;
  --ink: #101828;
  --muted: #55607a;
  --line: rgba(16, 24, 40, 0.14);
  --accent: #d8f524;
  --on-accent: #101828;
  --display: "Helvetica Neue", Helvetica, Arial, sans-serif;
  --body: "Helvetica Neue", Helvetica, Arial, sans-serif;
  --grid: rgba(16, 24, 40, 0.055);
}

/* The paper. A drawing grid at the size a scale rule would use, sitting under
   everything and never quite asserting itself. */
body {
  background-image:
    linear-gradient(var(--grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid) 1px, transparent 1px);
  background-size: 2.25rem 2.25rem;
}

.label {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted);
}

.hero { padding-block: clamp(3.5rem, 9vw, 7rem) var(--section); }

.hero h1 {
  font-size: clamp(2.25rem, 6vw, 4rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  margin-block: 0.75rem 0.25rem;
}

.hero .sub {
  color: var(--muted);
  max-width: 46ch;
  margin-top: 1rem;
}

/* The signature. Tabular figures so the digits sit on a grid the way stencilled
   lettering does, and a size capped by the viewport rather than by the type
   scale — a long number on a narrow phone has to shrink, and shrinking beats
   wrapping a phone number onto two lines. */
.dial {
  display: inline-block;
  margin-top: clamp(2rem, 5vw, 3rem);
  text-decoration: none;
  border-bottom: 0.5rem solid var(--accent);
  padding-bottom: 0.25rem;
  transition: transform 0.2s ease;
}
.dial:hover { transform: translateY(-2px); }
.dial .num {
  display: block;
  font-family: var(--display);
  font-size: clamp(2rem, 8.5vw, 5rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.dial .cta { display: block; margin-top: 0.5rem; }

.facts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 2.5rem;
  margin-top: 2.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--line);
}
.facts div { font-size: 0.9375rem; }
.facts b { font-weight: 700; }

.jobs { border-top: 2px solid var(--ink); }
.jobs li {
  display: grid;
  grid-template-columns: minmax(0, 18rem) minmax(0, 1fr);
  gap: 0.25rem 2rem;
  padding-block: 1.5rem;
  border-bottom: 1px solid var(--line);
}
.jobs h3 { font-size: 1.125rem; font-weight: 700; letter-spacing: -0.01em; }
.jobs p { color: var(--muted); }
@media (max-width: 46rem) { .jobs li { grid-template-columns: 1fr; } }

.about p { margin-top: 1.25rem; font-size: clamp(1.0625rem, 1rem + 0.4vw, 1.375rem); }

.visit { display: grid; gap: var(--gutter); grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); }
.visit h3 { font-size: 0.75rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); font-weight: 700; }
.visit ul, .visit p { margin-top: 0.875rem; }
.visit li { padding-block: 0.25rem; font-variant-numeric: tabular-nums; }
.visit a { text-underline-offset: 3px; }

.quotes { display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr)); margin-top: 2rem; }
.quotes blockquote { margin: 0; padding-left: 1.25rem; border-left: 3px solid var(--accent); }
.quotes p { font-size: 1.0625rem; }
.quotes cite { display: block; margin-top: 0.75rem; font-style: normal; font-size: 0.875rem; color: var(--muted); }

footer { border-top: 2px solid var(--ink); padding-block: 2.5rem 3.5rem; }
footer .name { color: var(--ink); }
footer .fine { margin-top: 0.5rem; font-size: 0.875rem; color: var(--muted); }
`;

const render = ({ business, copy }: SiteContent) => {
  const where = [business.trade, business.town].filter(Boolean).join(" · ");

  const html = `
<a class="skip" href="#main">Skip to content</a>
<header class="wrap hero">
  <p class="label">${esc(where)}</p>
  <h1>${esc(copy.headline)}</h1>
  ${when(copy.subhead, (sub) => `<p class="sub">${esc(sub)}</p>`)}
  ${when(
    business.phone,
    (phone) => `
  <a class="dial" href="${telHref(phone)}">
    <span class="num">${esc(phone)}</span>
    <span class="label cta">${esc(copy.ctaLabel || "Call now")}</span>
  </a>`,
  )}
  ${when(
    business.rating !== undefined || business.address !== undefined,
    () => `
  <div class="facts">
    ${when(
      business.rating,
      (rating) =>
        `<div><b>${esc(rating.toFixed(1))}</b> out of 5${when(
          business.reviewCount,
          (count) => ` from ${esc(count)} reviews`,
        )}</div>`,
    )}
    ${when(business.address, (address) => `<div>${esc(address)}</div>`)}
  </div>`,
  )}
</header>

<main id="main">
  ${whenAny(
    copy.services,
    (services) => `
  <section class="wrap section reveal">
    <h2 class="sr">What we do</h2>
    <ul class="jobs">
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
    <h2 class="label">About</h2>
    <div class="prose"><p>${esc(about)}</p></div>
  </section>`,
  )}

  ${whenAny(
    copy.reviews,
    (reviews) => `
  <section class="wrap section reveal">
    <h2 class="label">What people say</h2>
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
      ${whenAny(
        business.hours,
        (hours) => `
      <div>
        <h3>Hours</h3>
        <ul>${map(hours, (line) => `<li>${esc(line)}</li>`)}</ul>
      </div>`,
      )}
    </div>
  </section>
</main>

<footer class="wrap">
  <p class="label name">${esc(business.name)}</p>
  ${when(copy.closing, (closing) => `<p class="fine">${esc(closing)}</p>`)}
  ${when(business.town, (town) => `<p class="fine">${esc(business.trade)} in ${esc(town)}</p>`)}
</footer>`;

  return { html, css: CSS };
};

export const plumbline: Template = {
  name: "plumbline",
  description: "Trades. The phone number is the hero, set like van lettering.",
  render,
};
