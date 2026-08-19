import { useState } from "react";
import { ExternalLinkIcon, GlobeIcon, RefreshCcwIcon, TimerIcon } from "lucide-react";

import { Hint } from "@/components/hint";
import type { Fragment } from "@/modules/projects/types";
import { Button } from "@/components/ui/button";

interface Props {
  data: Fragment;
};

export function FragmentWeb({ data }: Props) {
  const [copied, setCopied] = useState(false);
  const [fragmentKey, setFragmentKey] = useState(0);

  // Two addresses, and only one of them is worth giving to anybody.
  //
  // `sandboxUrl` is the bench: the dev server this was built on, live and
  // current, and parked after fifteen idle minutes. `siteUrl` is the copy in
  // R2, which does not change until the next build and does not stop
  // answering. So the bar shares the published one and the frame shows the
  // live one — the address a client is sent must outlast the afternoon, and
  // the thing on screen should be what was just built.
  const share = data.siteUrl || data.sandboxUrl;
  const preview = data.sandboxUrl || data.siteUrl || "";
  const published = Boolean(data.siteUrl);

  const onRefresh = () => {
    setFragmentKey((prev) => prev + 1);
  };

  const handleCopy = () => {
    if (!share) return;
    navigator.clipboard.writeText(share);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col w-full h-full">
      <div className="p-2 border-b bg-sidebar flex items-center gap-x-2">
        <Hint text="Refresh" side="bottom" align="start">
          <Button size="sm" variant="outline" onClick={onRefresh}>
            <RefreshCcwIcon />
          </Button>
        </Hint>
        <Hint
          text={
            published
              ? "Published — click to copy. This link keeps working."
              : "Preview only — this link stops working when the sandbox sleeps."
          }
          side="bottom"
        >
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleCopy}
            disabled={!share || copied}
            className="flex-1 justify-start text-start font-normal"
          >
            {published ? (
              <GlobeIcon className="text-emerald-600 dark:text-emerald-500" />
            ) : (
              <TimerIcon className="text-muted-foreground" />
            )}
            <span className="truncate">
              {copied ? "Copied" : share}
            </span>
          </Button>
        </Hint>
        <Hint text="Open in a new tab" side="bottom" align="start">
          <Button
            size="sm"
            disabled={!share}
            variant="outline"
            onClick={() => {
              if (!share) return;
              window.open(share, "_blank");
            }}
          >
            <ExternalLinkIcon />
          </Button>
        </Hint>
      </div>
      <iframe
        key={fragmentKey}
        className="h-full w-full"
        sandbox="allow-forms allow-scripts allow-same-origin"
        loading="lazy"
        src={preview}
      />
    </div>
  )
};
