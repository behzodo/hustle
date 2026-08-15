import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";

import { api } from "@/../convex/_generated/api";

/**
 * The caller's profile, read from Convex on the server.
 *
 * Convex authenticates by JWT, so a server component has to mint one from
 * Clerk and hand it over explicitly — there is no ambient session the way
 * there was with a direct database connection.
 */
export const getProfile = async () => {
  const { userId, getToken } = await auth();

  if (!userId) return null;

  try {
    // Throws outright if the "convex" JWT template is missing from the
    // Clerk instance, so it has to be inside the guard too.
    const token = await getToken({ template: "convex" });

    if (!token) return null;

    return await fetchQuery(api.profiles.status, {}, { token });
  } catch {
    // A backend blip should not wall people out of the product.
    return null;
  }
};

/**
 * Sends signed-in users who have not finished the wizard to /onboarding.
 * Called from the workspace pages rather than middleware: the sign-in and
 * sign-up routes share a layout with them, and gating there would trap
 * people before they even have a session.
 */
export const requireOnboarding = async () => {
  const { userId } = await auth();

  // Not signed in — middleware already handles that redirect.
  if (!userId) return null;

  const profile = await getProfile();

  if (!profile) {
    redirect("/onboarding");
  }

  return profile;
};
