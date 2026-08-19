import { auth } from "@clerk/nextjs/server";

import { configured, search } from "@/domains";

/**
 * What this business could be called.
 *
 * Behind a sign-in because every call costs a registrar lookup and an open
 * search box is a free availability API for anybody who finds it.
 *
 * Deliberately not a Convex query. A search is a network call to somebody
 * else's registry, which a Convex query cannot make — and it should not be
 * cached or subscribed to either: a name that was free two minutes ago is a
 * name somebody else may have just bought.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  if (!configured()) {
    return Response.json(
      { error: "The domain shop is not set up on this environment yet." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();

  if (name.length < 2 || name.length > 60) {
    return Response.json({ offers: [] });
  }

  try {
    return Response.json({ offers: await search(name) });
  } catch (cause) {
    return Response.json(
      { error: cause instanceof Error ? cause.message : "Could not search that." },
      { status: 502 },
    );
  }
}
