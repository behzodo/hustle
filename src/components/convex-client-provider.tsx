"use client";

import { ReactNode } from "react";
import { useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";

// One client for the whole app. Created at module scope so a re-render never
// tears down the WebSocket — every reactive subscription rides on it.
const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Bridges Clerk's session into Convex.
 *
 * ConvexProviderWithClerk fetches a Clerk JWT for the "convex" template and
 * refreshes it before expiry, which is what makes ctx.auth.getUserIdentity()
 * work inside every query and mutation. Without this the backend sees every
 * request as anonymous.
 *
 * Must sit inside <ClerkProvider>, since it calls useAuth().
 */
export const ConvexClientProvider = ({ children }: { children: ReactNode }) => {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
};
