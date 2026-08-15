"use client";

import { useEffect, useState } from "react";
import { ArrowUpIcon, Loader2Icon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import SpecularButton from "@/components/SpecularButton";
import { useCurrentTheme } from "@/hooks/use-current-theme";

interface Props {
  disabled?: boolean;
  pending?: boolean;
};

export const SendButton = ({ disabled, pending }: Props) => {
  const isDark = useCurrentTheme() === "dark";

  // Same two gates as the metallic mark: the shader is WebGL2 on a permanent
  // rAF, so it only mounts when the browser can run it and the visitor hasn't
  // asked for less motion. The plain button is also what server-renders.
  const [specular, setSpecular] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!document.createElement("canvas").getContext("webgl2")) return;

    setSpecular(true);
  }, []);

  // The button is wide enough to carry a word now, so it says what it does
  // instead of leaving an arrow to imply it — and the label doubles as the
  // accessible name.
  const label = (
    <span className="flex items-center gap-2">
      {pending ? "Sending" : "Send"}
      {pending ? (
        <Loader2Icon className="size-4 animate-spin" />
      ) : (
        <ArrowUpIcon className="size-4" />
      )}
    </span>
  );

  if (!specular) {
    return (
      <Button
        type="submit"
        disabled={disabled}
        className={cn(
          "h-10 px-5 rounded-[10px] text-sm font-semibold",
          disabled && "bg-muted-foreground border"
        )}
      >
        {label}
      </Button>
    );
  }

  return (
    <SpecularButton
      type="submit"
      size="sm"
      disabled={disabled}
      // Rounded rectangle rather than a pill or a circle. The shader draws
      // its rim from this same value, so the highlight tracks the corners.
      radius={10}
      // A specular rim needs the light to be the inverse of the surface it
      // sits on. Primary flips between themes, so the rim flips with it:
      // a bright highlight on the black button, a defined edge on the white.
      tint={isDark ? "#fafafa" : "#111111"}
      tintOpacity={1}
      textColor={isDark ? "#141414" : "#ffffff"}
      lineColor={isDark ? "#0a0a0a" : "#ffffff"}
      baseColor={isDark ? "#8a8a8a" : "#4a4a4a"}
      // The registry size classes set both padding axes at once; height is
      // pinned here so the two branches match exactly.
      className="h-10 px-5! py-0! text-sm! font-semibold!"
    >
      {label}
    </SpecularButton>
  );
};
