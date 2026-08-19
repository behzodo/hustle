import type { Metadata, Viewport } from "next";
import { after } from "next/server";
import { ThemeProvider } from "next-themes";
import { ClerkProvider } from "@clerk/nextjs";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";

import { siteConfig } from "@/lib/site";
import { syncPlan } from "@/lib/entitlement";
import { Toaster } from "@/components/ui/sonner";
import { TRPCReactProvider } from "@/trpc/client";
import { ConvexClientProvider } from "@/components/convex-client-provider";
import { clerkLocalization } from "@/lib/clerk-localization";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display face, used only for the pricing headline. The variable axes are
// requested here so the headline can dial in optical size and Fraunces'
// WONK alternates; see the .headline-* rules in globals.css.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

// metadataBase resolves every relative URL below (OG image, canonicals), so
// social crawlers get absolute links instead of localhost ones.
export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.title,
    // Child routes set a bare title; the brand is appended here.
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [...siteConfig.keywords],
  applicationName: siteConfig.name,
  authors: [{ name: siteConfig.name, url: siteConfig.url }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: siteConfig.title,
    description: siteConfig.description,
    url: siteConfig.url,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  // Stops iOS/Android from auto-linking anything that merely looks like a
  // phone number or address inside generated app content.
  formatDetection: {
    telephone: false,
    address: false,
    email: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: siteConfig.colors.background },
    { media: "(prefers-color-scheme: dark)", color: siteConfig.colors.backgroundDark },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // After the response, not during it. Clerk holds the plan and Convex holds
  // the balance, and this is the only line between them — but it is a network
  // call on the way to a billing lookup, and nobody should wait behind one to
  // see a page. See src/lib/entitlement.ts for why it has to happen here at
  // all rather than travelling in the token.
  after(syncPlan);

  return (
    <ClerkProvider
      localization={clerkLocalization}
      appearance={{
        layout: {
          // Swaps Clerk's default app logo for the Hustle mark across every
          // Clerk component (sign-in, sign-up, user profile, org switcher).
          logoImageUrl: "/logo.svg",
          logoLinkUrl: "/",
          logoPlacement: "inside",
        },
        variables: {
          colorPrimary: siteConfig.colors.primary,
        },
      }}
    >
      <ConvexClientProvider>
        <TRPCReactProvider>
        <html lang="en" suppressHydrationWarning>
          <body
            className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} antialiased`}
          >
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <Toaster />
              {children}
            </ThemeProvider>
          </body>
        </html>
        </TRPCReactProvider>
      </ConvexClientProvider>
    </ClerkProvider>
  );
};
