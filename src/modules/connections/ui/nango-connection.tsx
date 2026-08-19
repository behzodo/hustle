"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import Nango from "@nangohq/frontend";
import { Check, Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { IntegrationKey } from "@/lib/nango";

import { ConnectionCard } from "./connection-card";

/**
 * One connection, whichever provider it is.
 *
 * Extracted when the second and third arrived: Gmail, Twilio, Instagram and
 * Facebook differ by a logo, two sentences and a string, and three more copies
 * of the same eighty lines is three more places for the session-token dance to
 * drift out of step.
 *
 * What every one of them shares is the shape of the promise. Nango runs the
 * flow and holds whatever comes back — an OAuth token for Google and Meta, an
 * Account SID and Auth Token for Twilio — and the only thing that reaches this
 * app is a connection id, which is useless to anybody who steals it.
 */

interface Props {
  /** Which provider, by the key in src/lib/nango.ts. */
  integration: IntegrationKey;
  logo: ReactNode;
  name: string;
  /** Shown before connecting: what this unlocks, in the user's terms. */
  pitch: string;
  /** Shown after: what it is now doing. */
  connectedNote: string;
  connected?: boolean;
  /**
   * Called with the new connection id, to store against the profile.
   *
   * The return is ignored — a Convex mutation resolves to null and every
   * caller here is one — so this is `unknown` rather than `void`, which would
   * reject them all.
   */
  onConnected: (connectionId: string) => Promise<unknown>;
  /** Extra controls under the card once it is live — buying a number, say. */
  children?: ReactNode;
  muted?: boolean;
}

export const NangoConnection = ({
  integration,
  logo,
  name,
  pitch,
  connectedNote,
  connected,
  onConnected,
  children,
  muted,
}: Props) => {
  const [connecting, setConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(Boolean(connected));

  const onConnect = async () => {
    setConnecting(true);

    try {
      const nango = new Nango();

      // Nango's guidance: open the UI first so it can show its own loading
      // state, then hand it the token. Fetching first leaves the user staring
      // at nothing while the round trip completes.
      const connectUI = nango.openConnectUI({
        onEvent: (event) => {
          if (event.type === "connect") {
            void onConnected(event.payload.connectionId)
              .then(() => {
                setIsConnected(true);
                toast.success(`${name} connected`);
              })
              .catch(() => toast.error("Connected, but we could not save it"));

            connectUI.close();
            setConnecting(false);
          }

          if (event.type === "close") setConnecting(false);

          if (event.type === "error") {
            toast.error(event.payload.errorMessage);
            setConnecting(false);
          }
        },
      });

      // The secret key stays on the server; the browser only ever sees a
      // single-use token scoped to this provider and this one user.
      const res = await fetch("/api/nango/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integration }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        connectUI.close();
        throw new Error(body.error ?? "Could not start the connection");
      }

      const { sessionToken } = await res.json();
      connectUI.setSessionToken(sessionToken);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : `Could not connect ${name}`,
      );
      setConnecting(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <ConnectionCard
        logo={logo}
        name={name}
        description={isConnected ? connectedNote : pitch}
        muted={muted}
        action={
          isConnected ? (
            <span className="text-primary inline-flex items-center gap-1.5 text-sm font-medium">
              <Check className="size-4" /> Connected
            </span>
          ) : (
            <Button
              onClick={onConnect}
              disabled={connecting}
              className="h-10 rounded-lg px-4 text-sm font-medium tracking-tight"
            >
              {connecting ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" /> Connecting
                </>
              ) : (
                "Connect"
              )}
            </Button>
          )
        }
      />

      {isConnected && children}
    </div>
  );
};
