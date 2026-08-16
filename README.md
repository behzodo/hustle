<div align="center">

# Hustle

**Find the business. Build their site. Then pitch.**

Hustle is for freelancers who sell websites to local businesses. Describe a
business, and an AI agent builds them a real Next.js site in a live sandbox —
so you turn up with the work already done.

[![CI](https://github.com/behzodo/hustle/actions/workflows/ci.yml/badge.svg)](https://github.com/behzodo/hustle/actions/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-15-000?logo=next.js)](https://nextjs.org)
[![Convex](https://img.shields.io/badge/Convex-reactive%20db-EE342F)](https://convex.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)

</div>

---

## How it works

```
 you type                agent runs                  you pitch
┌──────────────┐      ┌──────────────────┐      ┌──────────────────┐
│ "a dentist   │─────▶│ E2B sandbox      │─────▶│ live URL + files │
│  in Leeds"   │      │ writes Next.js   │      │ ready to send    │
└──────────────┘      └──────────────────┘      └──────────────────┘
   1 credit            Inngest orchestrates        Gmail · Stripe
```

1. **Describe a business.** One prompt is all the agent needs.
2. **The agent builds.** An [E2B](https://e2b.dev) sandbox boots, the agent
   writes and runs real files, and you get a live URL plus every file it wrote.
3. **Pitch it.** Send the finished site from your own Gmail; invoice through
   Stripe Connect when they say yes.

## Two hosts, one codebase

| | |
|---|---|
| `hustle.com` | Marketing landing |
| `app.hustle.com` | The workspace |

[`src/middleware.ts`](src/middleware.ts) rewrites `app.<domain>/x` to the
routes under `src/app/app/`, so links stay clean and auth runs against the
resolved path.

## The workspace

| Section | What it does |
|---|---|
| **Dashboard** | Sites built, credits left, pipeline and funnel charts |
| **Your hustles** | Every build, each with a CSS miniature of its page |
| **Connections** | Gmail via Nango, Stripe Connect for invoicing |
| **Support** | In-app AI assistant on Groq, plus a floating widget |
| **Feedback** | Goes straight to a Convex table |

## Stack

**Next.js 15** · React 19 · TypeScript · Tailwind v4 · shadcn/ui
**Convex** — reactive database. The chat updates by subscription, not polling
**Inngest** — orchestrates agent runs that outlive any serverless timeout
**E2B** — the sandbox each site is built and served from
**Clerk** — auth and billing · **Groq** — the support assistant
**Nango** — Gmail OAuth · **Stripe Connect** — invoicing and payouts

### Why the split between Inngest and Convex

A build drives a sandbox for up to 30 minutes; a Convex action is capped at
10. So Inngest keeps orchestrating and calls back through the HTTP actions in
[`convex/http.ts`](convex/http.ts) to persist what it produced. Those routes
hold a shared secret, because the mutations behind them write assistant
messages into any project and must never be publicly callable.

## Running it

### 1. Build the E2B template (required)

Docker must be running.

```bash
npm i -g @e2b/cli
e2b auth login

cd sandbox-templates/nextjs
e2b template build --name your-template-name --cmd "/compile_page.sh"
```

Then set the name in [`src/inngest/functions.ts`](src/inngest/functions.ts).

### 2. Start

```bash
npm install
npx convex dev          # keep running: pushes functions, serves the database
npm run dev             # http://localhost:3000
npx inngest-cli@latest dev   # agent runs
```

The workspace is on the app subdomain: **http://app.localhost:3000**.

### 3. Environment

```bash
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_ORIGIN="http://app.localhost:3000"

# Convex — written by `npx convex dev`
NEXT_PUBLIC_CONVEX_URL=
NEXT_PUBLIC_CONVEX_SITE_URL=

# Clerk. Needs a JWT template named "convex" with a `features` claim,
# or every account falls back to the free credit allowance.
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

OPENAI_API_KEY=          # the code agent
GROQ_API_KEY=            # the support assistant
E2B_API_KEY=

# Same value on both sides:
#   npx convex env set AGENT_WEBHOOK_SECRET "<random>"
AGENT_WEBHOOK_SECRET=

NANGO_SECRET_KEY=        # optional, Gmail
STRIPE_SECRET_KEY=       # optional, invoicing
```

## Layout

```
convex/          schema, queries, mutations, HTTP actions
src/app/         routes — marketing at the root, workspace under /app
src/modules/     features: projects, hustles, dashboard, connections, support
src/inngest/     the agent run and its callbacks into Convex
src/components/  shared UI
sandbox-templates/  the E2B image builds run in
```

## Where it stands

Building, storing and previewing sites works end to end. Finding businesses
automatically, storing leads, and real revenue reporting do not exist yet —
the dashboard panels that show them are marked **sample** in the UI, and the
support assistant is told to say so.

See the [board](https://github.com/behzodo/hustle/projects) for what is next.

---

Built on the vibe-coding platform by
[CodeWithAntonio](https://codewithantonio.com), rebuilt into Hustle.
