# The Vite bench

What the agent builds a client site in.

Not a full project checked in: the image runs `npm create vite@latest` for the
scaffold, so React, Vite and TypeScript come at whatever version that template
currently pins and nothing here has to be kept in step with them by hand. The
files below are laid over the top afterwards — they are the parts the scaffold
gets wrong for this product.

  vite.config.ts   adds Tailwind, and binds the dev server to 0.0.0.0 so the
                   sandbox's preview proxy can reach it
  src/index.css    Tailwind v4, which is one import rather than a config file
  src/App.tsx      an empty page

App.tsx is deliberately blank. The scaffold ships a demo with a counter and two
logos, and an agent told to "build a plumber's site" on top of that leaves bits
of the demo in the footer — which is exactly the kind of thing a client notices
and you do not.
