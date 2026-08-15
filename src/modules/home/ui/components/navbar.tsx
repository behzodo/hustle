"use client";

import Link from "next/link";
import { SignedIn, SignedOut, SignInButton, SignUpButton } from "@clerk/nextjs";

import { cn } from "@/lib/utils";
import { useScroll } from "@/hooks/use-scroll";
import { Button } from "@/components/ui/button";
import { UserControl } from "@/components/user-control";
import { MetallicLogo } from "@/components/metallic-logo";
import { useClerkAppearance } from "@/lib/clerk-appearance";

export const Navbar = () => {
  const isScrolled = useScroll();
  const appearance = useClerkAppearance();

  return (
    <nav
      className={cn(
        "p-4 bg-transparent fixed top-0 left-0 right-0 z-50 transition-all duration-200 border-b border-transparent",
        isScrolled && "bg-background border-border"
      )}
    >
      <div className="max-w-5xl mx-auto w-full flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2">
          <MetallicLogo size={28} priority />
          <span className="font-semibold text-lg">Hustle</span>
        </Link>
        <SignedOut>
          {/* Modal rather than redirect: signing in happens over whatever the
              visitor was already looking at, and they land back on it. */}
          <div className="flex gap-2">
            <SignUpButton mode="modal" appearance={appearance}>
              <Button variant="outline" size="sm">
                Sign up
              </Button>
            </SignUpButton>
            <SignInButton mode="modal" appearance={appearance}>
              <Button size="sm">
                Sign in
              </Button>
            </SignInButton>
          </div>
        </SignedOut>
        <SignedIn>
          <UserControl showName />
        </SignedIn>
      </div>
    </nav>
  );
};
