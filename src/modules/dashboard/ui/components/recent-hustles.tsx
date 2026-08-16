"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { ArrowUpRightIcon } from "@phosphor-icons/react";

import { api } from "@/../convex/_generated/api";

/** The caller's newest projects — the one panel here reading live data. */
export const RecentHustles = () => {
  // undefined while the subscription is still opening.
  const projects = useQuery(api.projects.list, {});

  if (projects === undefined) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-muted/50 h-11 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (!projects?.length) {
    return (
      <div className="py-8 text-center">
        <p className="text-muted-foreground text-sm">Nothing built yet.</p>
        <Link
          href="/"
          className="mt-2 inline-block text-sm font-medium underline underline-offset-4"
        >
          Build your first site
        </Link>
      </div>
    );
  }

  return (
    <ul className="divide-y">
      {projects.slice(0, 5).map((project) => (
        <li key={project._id}>
          <Link
            href={`/projects/${project._id}`}
            className="group flex items-center gap-3 py-3 first:pt-0"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{project.name}</p>
              <p className="text-muted-foreground text-xs">
                {formatDistanceToNow(new Date(project.updatedAt), {
                  addSuffix: true,
                })}
              </p>
            </div>
            <ArrowUpRightIcon className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </li>
      ))}
    </ul>
  );
};
