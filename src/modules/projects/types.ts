import type { Doc, Id } from "@/../convex/_generated/dataModel";

// One place for the shapes the project UI passes around, so components stop
// importing them from the generated Prisma client. Derived from the Convex
// schema, which means a field renamed in convex/schema.ts breaks the build
// here rather than at runtime.
export type Fragment = Doc<"fragments">;
export type ProjectId = Id<"projects">;

/** A message with its fragment attached, as convex/messages.ts:list returns. */
export type ProjectMessage = Doc<"messages"> & { fragment: Fragment | null };
