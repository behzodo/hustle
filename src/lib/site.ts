export const siteConfig = {
  name: "Hustle",
  title: "Hustle · Win web clients with the site already built",
  description:
    "Hustle finds local businesses that need a website, builds the site before you pitch, and turns that head start into a signed client.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  keywords: [
    "find web design clients",
    "AI lead generation",
    "web design agency tools",
    "cold outreach websites",
    "spec site outreach",
    "local business websites",
  ],
  colors: {
    // Hex mirrors of the oklch tokens in globals.css, for the places that
    // can't read CSS variables — the theme-color meta tag and Clerk, which
    // resolves its appearance at runtime.
    background: "#fcfcfc",
    backgroundDark: "#1f1f1f",
    // Primary inverts between themes: near-black on light, near-white on
    // dark. Anything sitting ON primary has to invert with it.
    primary: "#111111",
    primaryDark: "#fafafa",
    onPrimary: "#ffffff",
    onPrimaryDark: "#141414",
  },
} as const;

// The workspace lives on the app subdomain; the landing page sits on the
// bare domain. Links between them have to be absolute because they cross
// hosts. Set NEXT_PUBLIC_APP_ORIGIN in production (e.g. https://app.hustle.com).
export const APP_ORIGIN =
  process.env.NEXT_PUBLIC_APP_ORIGIN ?? "http://app.localhost:3000";

export const appUrl = (path = "/") => `${APP_ORIGIN}${path}`;

// Where a landing-page CTA drops you once you have a session. The dashboard,
// not the workspace root: signing in should land on the overview, not straight
// into an empty build prompt.
export const WORKSPACE_ENTRY = appUrl("/dashboard");
