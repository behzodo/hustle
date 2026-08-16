"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { PlusIcon } from "@phosphor-icons/react";

import { api } from "@/../convex/_generated/api";
import { Button } from "@/components/ui/button";

import { HustleCover } from "../components/hustle-cover";

/** The card that starts a new build. Always first, always the same size. */
const NewHustleCard = () => (
  <Link href="/" className="group flex flex-col">
    <div className="border-muted-foreground/25 group-hover:border-muted-foreground/50 relative aspect-video overflow-hidden rounded-2xl border border-dashed transition-all duration-300 group-hover:-translate-y-1">
      {/* The same miniature, faded back — an empty slot showing what will
          fill it, rather than a dead dashed box. */}
      <HustleCover
        name="new hustle"
        className="absolute inset-0 opacity-30 blur-[1px] transition-all duration-500 group-hover:opacity-60 group-hover:blur-0"
      />

      <div className="bg-background/40 absolute inset-0 flex items-center justify-center backdrop-blur-[1px]">
        <span className="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-full shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-90">
          <PlusIcon className="size-5" weight="bold" />
        </span>
      </div>
    </div>
    <div className="px-1 pt-3">
      <p className="text-sm font-medium">New hustle</p>
      <p className="text-muted-foreground text-sm">
        Name a business, get their site
      </p>
    </div>
  </Link>
);

const HustleCard = ({
  id,
  name,
  updatedAt,
}: {
  id: string;
  name: string;
  updatedAt: Date;
}) => (
  <Link href={`/projects/${id}`} className="group flex flex-col">
    {/* No name plate over the top: the miniature is the picture, and the
        name is already set directly under the card. */}
    <div className="relative aspect-video overflow-hidden rounded-2xl border transition-transform duration-300 group-hover:-translate-y-1">
      <HustleCover name={name} className="absolute inset-0" />
    </div>
    <div className="px-1 pt-3">
      <p className="truncate text-sm font-medium">{name}</p>
      <p className="text-muted-foreground text-sm">
        Edited {formatDistanceToNow(updatedAt, { addSuffix: true })}
      </p>
    </div>
  </Link>
);

const CardSkeleton = () => (
  <div className="flex flex-col">
    <div className="bg-muted/50 aspect-video animate-pulse rounded-2xl" />
    <div className="space-y-2 px-1 pt-3">
      <div className="bg-muted/50 h-4 w-2/3 animate-pulse rounded" />
      <div className="bg-muted/50 h-4 w-1/3 animate-pulse rounded" />
    </div>
  </div>
);

export const HustlesView = () => {
  const projects = useQuery(api.projects.list, {});

  return (
    <div className="flex w-full flex-col gap-8 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="headline-display font-display text-3xl leading-[1.02] tracking-[-0.03em] text-balance md:text-4xl">
            Your hustles
          </h1>
          <p className="deck font-display text-muted-foreground mt-2 text-balance">
            Every site you have built, and the one you have not started yet.
          </p>
        </div>

        <Button
          asChild
          className="h-11 rounded-xl px-5 text-sm font-medium tracking-tight"
        >
          <Link href="/">
            <PlusIcon className="size-4" />
            New hustle
          </Link>
        </Button>
      </div>

      <div className="grid gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
        <NewHustleCard />

        {projects === undefined &&
          [0, 1, 2].map((i) => <CardSkeleton key={i} />)}

        {projects?.map((project) => (
          <HustleCard
            key={project._id}
            id={project._id}
            name={project.name}
            updatedAt={new Date(project.updatedAt)}
          />
        ))}
      </div>
    </div>
  );
};
