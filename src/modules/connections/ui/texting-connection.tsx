"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { ChatCircleDotsIcon } from "@phosphor-icons/react";
import { Loader2Icon } from "lucide-react";

import { api } from "@/../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { NangoConnection } from "./nango-connection";

/**
 * Texting.
 *
 * The channel that reaches these businesses. Every Google listing carries a
 * phone number and almost none carry an email, so this is the difference
 * between pitching three businesses in a patch and pitching all of them.
 *
 * It runs on the user's own Twilio account, connected through this screen —
 * which is what makes it theirs rather than ours. They paste an Account SID
 * and an Auth Token once; after that everything happens here, and they never
 * open Twilio's console again. The number is bought on their account, the bill
 * is theirs, and so is the sending reputation.
 *
 * The registration line below is not small print. Texting US numbers for
 * business needs A2P 10DLC clearance from the carriers, it takes a few days,
 * and until it lands the carriers quietly filter the traffic. Saying so here
 * is the difference between a slow start and a hundred texts that appear to
 * send and never arrive.
 */

interface Available {
  number: string;
  locality?: string;
  region?: string;
}

interface Owned {
  sid: string;
  number: string;
  friendly: string;
  smsUrl?: string;
}

/** How a number reads to somebody who did not type it. */
const pretty = (e164: string) => {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);

  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
};

const NumberPicker = ({ number }: { number?: string }) => {
  const [areaCode, setAreaCode] = useState("");
  const [owned, setOwned] = useState<Owned[]>([]);
  const [available, setAvailable] = useState<Available[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [looked, setLooked] = useState(false);

  const look = async () => {
    setBusy("look");

    try {
      const res = await fetch(
        `/api/twilio/numbers${areaCode ? `?areaCode=${areaCode}` : ""}`,
      );
      const body = await res.json();

      if (!res.ok) throw new Error(body.error ?? "Could not reach Twilio");

      setOwned(body.owned ?? []);
      setAvailable(body.available ?? []);
      setLooked(true);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not look");
    } finally {
      setBusy(null);
    }
  };

  const take = async (chosen: string, sid?: string) => {
    setBusy(chosen);

    try {
      const res = await fetch("/api/twilio/numbers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: chosen, sid }),
      });
      const body = await res.json();

      if (!res.ok) throw new Error(body.error ?? "Could not set that up");

      toast.success(`Texting from ${pretty(body.number)}`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "That did not work");
    } finally {
      setBusy(null);
    }
  };

  if (number) {
    return (
      <p className="text-muted-foreground border-border/60 ml-[3.75rem] rounded-lg border border-dashed px-3 py-2 text-sm">
        Texting from{" "}
        <span className="text-foreground font-mono">{pretty(number)}</span>. Replies
        come back to the pitch inbox.
      </p>
    );
  }

  return (
    <div className="border-border/60 ml-[3.75rem] flex flex-col gap-3 rounded-lg border border-dashed p-3">
      <div className="flex items-center gap-2">
        <Input
          value={areaCode}
          onChange={(event) => setAreaCode(event.target.value.replace(/\D/g, ""))}
          placeholder="Area code, e.g. 904"
          maxLength={3}
          className="h-8 w-40 text-sm"
        />
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          onClick={() => void look()}
          disabled={busy !== null}
        >
          {busy === "look" ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
          Find a number
        </Button>
      </div>

      {/* Anything they already pay for comes first. Buying somebody a second
          line when they have one is spending their money on nothing. */}
      {owned.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-muted-foreground/70 text-xs">Already on your account</p>
          {owned.map((one) => (
            <button
              key={one.sid}
              type="button"
              onClick={() => void take(one.number, one.sid)}
              disabled={busy !== null}
              className="hover:bg-muted/60 flex items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors"
            >
              <span className="font-mono">{pretty(one.number)}</span>
              <span className="text-muted-foreground text-xs">Use this one</span>
            </button>
          ))}
        </div>
      )}

      {available.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-muted-foreground/70 text-xs">
            Free to buy — about $1.15 a month, on your Twilio bill
          </p>
          {available.slice(0, 5).map((one) => (
            <button
              key={one.number}
              type="button"
              onClick={() => void take(one.number)}
              disabled={busy !== null}
              className="hover:bg-muted/60 flex items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors"
            >
              <span className="font-mono">{pretty(one.number)}</span>
              <span className="text-muted-foreground text-xs">
                {busy === one.number ? "Buying…" : [one.locality, one.region].filter(Boolean).join(", ")}
              </span>
            </button>
          ))}
        </div>
      )}

      {looked && owned.length === 0 && available.length === 0 && (
        <p className="text-muted-foreground text-xs">
          Nothing free in that area code. Try a neighbouring one.
        </p>
      )}

      <p className="text-muted-foreground/70 border-border/60 border-t pt-2 text-xs leading-relaxed">
        Texting US businesses needs A2P 10DLC registration with the carriers —
        Twilio&apos;s form, a few days, about $4 a month. Until it clears, carriers
        filter most business texts, so send a handful and check they land before
        you send a hundred.
      </p>
    </div>
  );
};

export const TextingConnection = ({
  connected,
  number,
}: {
  connected?: boolean;
  number?: string;
}) => {
  const setConnections = useMutation(api.profiles.setConnections);

  return (
    <NangoConnection
      integration="twilio"
      logo={<ChatCircleDotsIcon className="size-6 text-[#F22F46]" weight="fill" />}
      name="Texting"
      pitch="Every listing has a phone number and almost none have an email. Texting is how you reach the rest of the patch."
      connectedNote="Your own Twilio account. Your number, your bill, your reputation."
      connected={connected}
      onConnected={(connectionId) => setConnections({ twilioConnectionId: connectionId })}
    >
      <NumberPicker number={number} />
    </NangoConnection>
  );
};
