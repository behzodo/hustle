/**
 * The floor every template stands on.
 *
 * Not a design — there is deliberately no colour, no typeface and no spacing
 * rhythm in here. Those are what make one template a gym and another a salon,
 * and a shared value is one that has to suit both, which in practice means it
 * suits neither.
 *
 * What is shared is the part that is the same for every business on earth: a
 * reset, a page that works on a phone held at the side of a road, a keyboard
 * focus ring somebody can actually see, and a reveal that does not move for
 * anybody who asked for less motion. A template can override any of it. None
 * of them should need to.
 *
 * Every token below is declared here so a template only restates the ones it
 * changes, and so a value missing from a template still renders a page rather
 * than an unstyled document.
 */
export const BASE_CSS = `
:root {
  --ground: #ffffff;
  --ink: #111111;
  --muted: #5a5a5a;
  --line: rgba(0, 0, 0, 0.12);
  --accent: #111111;
  --on-accent: #ffffff;
  --display: system-ui, sans-serif;
  --body: system-ui, sans-serif;
  --radius: 0px;
  --measure: 62ch;
  --gutter: clamp(1.25rem, 5vw, 4rem);
  --section: clamp(4rem, 11vw, 9rem);
}

*, *::before, *::after { box-sizing: border-box; }

html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; }

body {
  margin: 0;
  background: var(--ground);
  color: var(--ink);
  font-family: var(--body);
  font-size: clamp(1rem, 0.95rem + 0.25vw, 1.125rem);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

h1, h2, h3 { font-family: var(--display); margin: 0; line-height: 1.05; }
p { margin: 0; }
img { max-width: 100%; display: block; }
ul { margin: 0; padding: 0; list-style: none; }

a { color: inherit; }

/* The ring is on :focus-visible only, so a mouse never sees it and a keyboard
   always does — an outline suppressed for tidiness is a site nobody can tab
   through. Offset so it reads as a ring rather than a border. */
:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 3px;
  border-radius: 2px;
}

/* Not display:none — a screen reader should still announce the heading a
   section is titled by, even where the design shows it as a rule or a number. */
.sr {
  position: absolute;
  width: 1px; height: 1px;
  margin: -1px; padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.wrap {
  width: 100%;
  max-width: 72rem;
  margin-inline: auto;
  padding-inline: var(--gutter);
}

.section { padding-block: var(--section); }

.prose { max-width: var(--measure); }

/* One skip link, because the first thing on these pages is a full-height hero
   and tabbing past it otherwise takes a while. */
.skip {
  position: absolute;
  left: -9999px;
  top: 0;
  z-index: 10;
  padding: 0.75rem 1rem;
  background: var(--accent);
  color: var(--on-accent);
}
.skip:focus { left: 0; }

/* Revealed on scroll. Written so that the un-revealed state only exists where
   the browser can undo it: without IntersectionObserver support, or with
   JavaScript off, .reveal never gets its class and everything is simply
   visible. A page that hides its own content when a script fails is not a
   page. */
.reveal { opacity: 0; transform: translateY(1.25rem); }
.reveal.seen {
  opacity: 1;
  transform: none;
  transition: opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1),
              transform 0.7s cubic-bezier(0.22, 1, 0.36, 1);
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  .reveal, .reveal.seen { opacity: 1; transform: none; transition: none; }
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
`;

/**
 * The only script on the page.
 *
 * Inlined rather than a file because it is four lines and a request costs more
 * than it does, and guarded on IntersectionObserver so that the fallback is
 * the content being visible rather than the content being gone.
 */
export const REVEAL_JS = `
if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('seen'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -12% 0px' });
  document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
} else {
  document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('seen'); });
}
`;
