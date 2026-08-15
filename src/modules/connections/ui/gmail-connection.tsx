"use client";

import { toast } from "sonner";
import { useState } from "react";
import Nango from "@nangohq/frontend";
import { useMutation } from "convex/react";
import { Check, Loader2Icon } from "lucide-react";

import { api } from "@/../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Gmail } from "@/components/ui/svgs/gmail";

import { ConnectionCard } from "./connection-card";

interface Props {
  /** Set once the account has been linked. */
  connected?: boolean;
};

export const GmailConnection = ({ connected }: Props) => {
  const [connecting, setConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(Boolean(connected));

  const setConnections = useMutation(api.profiles.setConnections);

  const onConnect = async () => {
    setConnecting(true);

    try {
      const nango = new Nango();

      // Nango's guidance: open the UI first so it can show its own loading
      // state, then hand it the token. Fetching first leaves the user
      // staring at nothing while the round trip completes.
      const connectUI = nango.openConnectUI({
        onEvent: (event) => {
          if (event.type === "connect") {
            // Nango holds the tokens; we keep only the handle.
            void setConnections({
              gmailConnectionId: event.payload.connectionId,
            })
              .then(() => {
                setIsConnected(true);
                toast.success("Gmail connected");
              })
              .catch(() => toast.error("Connected, but we could not save it"));

            connectUI.close();
            setConnecting(false);
          }

          if (event.type === "close") {
            setConnecting(false);
          }

          if (event.type === "error") {
            toast.error(event.payload.errorMessage);
            setConnecting(false);
          }
        },
      });

      // The secret key stays on the server; the browser only ever sees a
      // single-use token scoped to Gmail and this one user.
      const res = await fetch("/api/nango/session", { method: "POST" });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        connectUI.close();
        throw new Error(body.error ?? "Could not start the connection");
      }

      const { sessionToken } = await res.json();
      connectUI.setSessionToken(sessionToken);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not connect Gmail"
      );
      setConnecting(false);
    }
  };

  return (
    <ConnectionCard
      logo={<Gmail className="size-6" />}
      name="Gmail"
      description={
        isConnected
          ? "Pitches send from your own inbox."
          : "Send pitches from your own inbox, so they land like a real email rather than a bulk blast."
      }
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
  );
};
