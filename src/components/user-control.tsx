"use client";

import { dark } from "@clerk/themes";
import { UserButton } from "@clerk/nextjs";

import { useCurrentTheme } from "@/hooks/use-current-theme";

interface Props {
  showName?: boolean;
}

export const UserControl = ({ showName }: Props) => {
  const currentTheme = useCurrentTheme();

  return (
    <UserButton
      showName={showName}
      appearance={{
        elements: {
          // Clerk lays the trigger out at its own intrinsic width, which in a
          // 240px rail let a long name run under the avatar. Pinning the box
          // to the container and truncating the identifier is what keeps the
          // two apart.
          userButtonBox: "w-full! min-w-0! gap-2.5!",
          userButtonTrigger:
            "w-full! justify-start! rounded-xl! px-1.5! py-1.5! focus:shadow-none!",
          userButtonAvatarBox: "rounded-lg! size-7! shrink-0!",
          userButtonOuterIdentifier:
            "min-w-0! truncate! pl-0! text-[13px]! font-medium!",
        },
        baseTheme: currentTheme === "dark" ? dark : undefined,
      }}
    />
  );
};
