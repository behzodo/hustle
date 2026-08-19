import * as daytona from "./daytona";
import * as e2b from "./e2b";
import { WorkshopError, type Bench, type Workshop, type WorkshopName } from "./types";

export {
  WorkshopError,
  type Bench,
  type BenchFile,
  type BuiltFile,
  type Ran,
  type Workshop,
  type WorkshopName,
} from "./types";

export { SITE_ROOT, SNAPSHOT, benchImage } from "./daytona";

/**
 * Which bench a build gets.
 *
 * Not the waterfall convex/lib/places uses, and the difference is worth
 * saying. A maps provider falls through because the tiers answer the same
 * question and any of them will do — the next one picks up the same search.
 * Sandboxes do not work like that. A project's files are on one machine, and a
 * build that failed halfway through on Daytona cannot be handed to E2B, which
 * has never seen them. So this picks one and stays with it.
 *
 * Order is preference, not fallback: Daytona when it is configured, E2B when
 * it is not. Which one a project actually used is stored with the project, and
 * `benchFor` below is what reads it — a Next.js project built last month must
 * keep opening on the provider whose image its files match.
 */
const ORDER: Workshop[] = [daytona.workshop, e2b.workshop];

const byName = new Map(ORDER.map((shop) => [shop.name, shop]));

/** The provider new builds are started on. */
export const workshop = (): Workshop => {
  const ready = ORDER.find((shop) => shop.configured());

  if (!ready) {
    throw new WorkshopError(
      "No sandbox provider is configured. Set DAYTONA_API_KEY (or E2B_API_KEY) in .env.",
      false,
    );
  }

  return ready;
};

/** A fresh bench on the preferred provider. */
export const openBench = (): Promise<Bench> => workshop().open();

/**
 * The bench a project was last built on, or a fresh one.
 *
 * Takes the provider by name rather than guessing it from the id, because the
 * answer has to survive the day Daytona becomes the default: a project built
 * on E2B keeps a sandbox id that means nothing to Daytona, and asking the
 * wrong provider about it returns "gone" rather than an error anyone can read.
 *
 * Returns what actually happened, because it changes what the caller does
 * next. A resumed bench already has the site on it. A fresh one is empty, and
 * whatever the agent wrote last time has to be written back before it can be
 * edited.
 */
export const benchFor = async (
  previous: { id: string; provider: WorkshopName } | null,
): Promise<{ bench: Bench; resumed: boolean }> => {
  if (previous) {
    const shop = byName.get(previous.provider);

    if (shop?.configured()) {
      const existing = await shop.reopen(previous.id);
      if (existing) return { bench: existing, resumed: true };
    }
  }

  return { bench: await openBench(), resumed: false };
};
