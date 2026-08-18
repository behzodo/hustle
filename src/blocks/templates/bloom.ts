import { attr, esc, map, telHref, url, when, whenAny } from "../html";
import type { SiteContent, Template } from "../types";

/**
 * bloom — salons, spas, nail bars, wellness, florists.
 *
 * A room full of mirrors and soft light. The signature is taken straight off
 * the wall: the photograph sits inside an arch, which is the shape of every
 * salon mirror ever hung, and the same curve is picked up by the panels
 * underneath it.
 *
 * The palette is deliberately not cream. Cream with a serif is where a page
 * like this lands when nobody chooses, and it belongs to bakeries anyway — see
 * the table template, which is allowed it. This one is pushed towards rose and
 * plum, which is the colour of the products on the shelf rather than the
 * colour of paper.
 *
 * Everything is set loose: long leading, wide tracking on the labels, and a
 * measure short enough to read slowly. The whole trade is unhurried and the
 * type ought to say so before the copy gets a chance to.
 */

const CSS = `
:root {
  --ground: #f6f1f2;
  --ink: #34222e;
  --muted: #7c6771;
  --line: rgba(52, 34, 46, 0.14);
  --accent: #b47f86;
  --on-accent: #ffffff;
  --gold: #a98a5f;
  --display: Georgia, "Iowan Old Style", "Times New Roman", serif;
  --body: "Segoe UI", system-ui, -apple-system, sans-serif;
  --radius: 999px;
  --measure: 56ch;
}

body { line-height: 1.75; }

.label {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--gold);
}

.hero { padding-block: clamp(3rem, 7vw, 5.5rem) var(--section); }
.hero .grid { display: grid; gap: clamp(2rem, 6vw, 4.5rem); grid-template-columns: minmax(0, 1fr); align-items: center; }
@media (min-width: 56rem) { .hero .grid { grid-template-columns: 1.05fr 0.95fr; } }

.hero h1 {
  font-family: var(--display);
  font-size: clamp(2.5rem, 6.5vw, 4.5rem);
  font-weight: 400;
  line-height: 1.05;
  letter-spacing: -0.015em;
  margin-block: 1rem 0;
}
.hero .sub { margin-top: 1.5rem; color: var(--muted); max-width: 42ch; }

/* The mirror. An arch is a top-heavy radius rather than a shape file, so it
   costs nothing and crops whatever photograph arrives without needing to know
   anything about it. */
.mirror {
  aspect-ratio: 3 / 4;
  border-radius: 999px 999px 0.75rem 0.75rem;
  background-size: cover;
  background-position: center;
  box-shadow: 0 2rem 4rem -2rem rgba(52, 34, 46, 0.4);
}
.mirror.empty { background: linear-gradient(160deg, #e7dade, #f6f1f2 60%); border: 1px solid var(--line); }

.act {
  display: inline-block;
  margin-top: 2rem;
  padding: 0.9375rem 2.25rem;
  border-radius: var(--radius);
  background: var(--accent);
  color: var(--on-accent);
  text-decoration: none;
  letter-spacing: 0.06em;
  font-size: 0.9375rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.act:hover { transform: translateY(-2px); box-shadow: 0 1rem 2rem -0.75rem rgba(180, 127, 134, 0.6); }

.menu { display: grid; gap: 1.25rem; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); margin-top: 2.5rem; }
.menu li { background: #fff; border: 1px solid var(--line); border-radius: 1.25rem 1.25rem 1.25rem 0.375rem; padding: 1.75rem; }
.menu h3 { font-family: var(--display); font-size: 1.375rem; font-weight: 400; }
.menu p { margin-top: 0.625rem; color: var(--muted); font-size: 0.9375rem; }

.about { text-align: center; }
.about .prose { margin-inline: auto; }
.about p { font-family: var(--display); font-size: clamp(1.25rem, 1.1rem + 0.8vw, 1.75rem); line-height: 1.5; margin-top: 1.5rem; }

.quotes { display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr)); margin-top: 2.5rem; }
.quotes blockquote { margin: 0; padding: 1.75rem; background: #fff; border-radius: 1.25rem; border: 1px solid var(--line); }
.quotes p { font-family: var(--display); font-size: 1.0625rem; line-height: 1.6; }
.quotes cite { display: block; margin-top: 1rem; font-style: normal; font-size: 0.8125rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--gold); }

.visit { display: grid; gap: var(--gutter); grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); }
.visit h3 { font-size: 0.6875rem; letter-spacing: 0.28em; text-transform: uppercase; color: var(--gold); font-weight: 600; }
.visit ul, .visit p { margin-top: 0.875rem; }
.visit li { padding-block: 0.1875rem; }

footer { border-top: 1px solid var(--line); padding-block: 2.5rem 3.5rem; text-align: center; }
footer .name { font-family: var(--display); font-size: 1.25rem; }
footer .fine { margin-top: 0.5rem; font-size: 0.875rem; color: var(--muted); }
`;

const render = ({ business, copy }: SiteContent) => {
  const html = `
<a class="skip" href="#main">Skip to content</a>
<header class="wrap hero">
  <div class="grid">
    <div>
      <p class="label">${esc([business.trade, business.town].filter(Boolean).join(" — "))}</p>
      <h1>${esc(copy.headline)}</h1>
      ${when(copy.subhead, (sub) => `<p class="sub">${esc(sub)}</p>`)}
      ${when(
        business.phone,
        (phone) =>
          `<a class="act" href="${telHref(phone)}">${esc(copy.ctaLabel || "Book an appointment")}</a>`,
      )}
    </div>
    ${
      business.photo
        ? `<div class="mirror" style="background-image:url('${url(business.photo)}')" role="img" aria-label="${attr(business.name)}"></div>`
        : `<div class="mirror empty" aria-hidden="true"></div>`
    }
  </div>
</header>

<main id="main">
  ${whenAny(
    copy.services,
    (services) => `
  <section class="wrap section reveal">
    <h2 class="label">Treatments</h2>
    <ul class="menu">
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
    <h2 class="label">Our studio</h2>
    <div class="prose"><p>${esc(about)}</p></div>
  </section>`,
  )}

  ${whenAny(
    copy.reviews,
    (reviews) => `
  <section class="wrap section reveal">
    <h2 class="label">Kind words</h2>
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
    <h2 class="sr">Visit us</h2>
    <div class="visit">
      ${when(
        business.phone,
        (phone) => `
      <div>
        <h3>Book</h3>
        <p><a href="${telHref(phone)}">${esc(phone)}</a></p>
        ${when(business.email, (email) => `<p><a href="mailto:${attr(email)}">${esc(email)}</a></p>`)}
      </div>`,
      )}
      ${when(
        business.address,
        (address) => `
      <div>
        <h3>Find us</h3>
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
  <p class="name">${esc(business.name)}</p>
  ${when(copy.closing, (closing) => `<p class="fine">${esc(closing)}</p>`)}
</footer>`;

  return { html, css: CSS };
};

export const bloom: Template = {
  name: "bloom",
  description: "Salons and spas. Rose and plum, the photo set in a mirror arch.",
  render,
};
