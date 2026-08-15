import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { Nango } from "@nangohq/node";

import { GMAIL_INTEGRATION_ID, NANGO_SECRET_KEY } from "@/lib/nango";

/**
 * Mints a short-lived Nango Connect session for the signed-in user.
 *
 * The secret key must never reach the browser, so the session is created
 * here and only the token goes back. The token is scoped to one integration
 * and one end user, so it cannot be used to connect anything else.
 */
export const POST = async () => {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!NANGO_SECRET_KEY) {
    return NextResponse.json(
      { error: "Nango is not configured on this environment" },
      { status: 503 }
    );
  }

  const user = await currentUser();
  const nango = new Nango({ secretKey: NANGO_SECRET_KEY });

  try {
    const res = await nango.createConnectSession({
      // Keyed by the Clerk user id, so reconnecting replaces the same
      // connection rather than piling up duplicates.
      end_user: {
        id: userId,
        email: user?.primaryEmailAddress?.emailAddress,
        display_name: user?.fullName ?? undefined,
      },
      allowed_integrations: [GMAIL_INTEGRATION_ID],
    });

    return NextResponse.json({ sessionToken: res.data.token });
  } catch (error) {
    console.error("Nango session failed", error);

    return NextResponse.json(
      { error: "Could not start the Google connection" },
      { status: 502 }
    );
  }
};
