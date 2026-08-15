"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { SignedIn, SignedOut, SignInButton, SignUpButton } from "@clerk/nextjs";

import { appUrl } from "@/lib/site";
import { Button } from "@/components/ui/landing-button";
import { useClerkAppearance } from "@/lib/clerk-appearance";

type Props = Omit<
  ComponentProps<typeof Button>,
  "children" | "render" | "nativeButton"
> & {
  children: ReactNode;
  /** Shown once the visitor already has a session — the modal would be a
   *  dead end for them, so the button becomes a link into the workspace.
   *  Pass null to render nothing at all for signed-in visitors. */
  signedInLabel?: ReactNode;
};

// The landing page and the workspace are served from different hosts, so
// these CTAs used to be cross-host links out to /sign-up. Clerk's modal keeps
// the visitor on the section they were reading and only hands them over to
// the workspace once they're actually signed in.
export const SignUpCta = ({
  children,
  signedInLabel = "Open Hustle",
  ...buttonProps
}: Props) => {
  const appearance = useClerkAppearance();

  return (
    <>
      <SignedOut>
        <SignUpButton
          mode="modal"
          appearance={appearance}
          forceRedirectUrl={appUrl("/")}
          signInForceRedirectUrl={appUrl("/")}
        >
          <Button {...buttonProps}>{children}</Button>
        </SignUpButton>
      </SignedOut>
      <SignedIn>
        <Button
          {...buttonProps}
          nativeButton={false}
          render={<Link href={appUrl("/")}>{signedInLabel}</Link>}
        />
      </SignedIn>
    </>
  );
};

// Defaults to rendering nothing for signed-in visitors: this button always
// sits next to a SignUpCta, and "log in" is a no-op once you have a session —
// leaving it in produced two identical buttons side by side.
export const SignInCta = ({
  children,
  signedInLabel = null,
  ...buttonProps
}: Props) => {
  const appearance = useClerkAppearance();

  return (
    <>
      <SignedOut>
        <SignInButton
          mode="modal"
          appearance={appearance}
          forceRedirectUrl={appUrl("/")}
          signUpForceRedirectUrl={appUrl("/")}
        >
          <Button {...buttonProps}>{children}</Button>
        </SignInButton>
      </SignedOut>
      {signedInLabel ? (
        <SignedIn>
          <Button
            {...buttonProps}
            nativeButton={false}
            render={<Link href={appUrl("/")}>{signedInLabel}</Link>}
          />
        </SignedIn>
      ) : null}
    </>
  );
};
