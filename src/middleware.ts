import { NextResponse } from 'next/server';
import { clerkMiddleware } from '@clerk/nextjs/server';

// Routes live under src/app/app/, but the app subdomain serves them from the
// root of its own host. Everything below rewrites app.<domain>/x to /app/x so
// URLs stay clean and existing links like href="/pricing" keep working.
const APP_SUBDOMAIN = 'app';

// Matched against the *resolved* internal path, not the incoming one. The
// rewrite has to be worked out first, or a request to app.<domain>/connections
// gets tested as "/connections" and matches nothing.
const PUBLIC_PATHS = [
  /^\/$/,
  /^\/app$/,
  /^\/app\/sign-in(\/.*)?$/,
  /^\/app\/sign-up(\/.*)?$/,
  /^\/api(\/.*)?$/,
  /^\/app\/pricing(\/.*)?$/,
  // Marketing-host legal pages — must stay reachable signed out.
  /^\/privacy$/,
  /^\/terms$/,
  // Crawler-facing metadata routes. The matcher below doesn't exempt .txt
  // or .xml, so without these Googlebot gets redirected to sign-in.
  /^\/robots\.txt$/,
  /^\/sitemap\.xml$/,
  /^\/manifest\.webmanifest$/,
];

const isPublicPath = (pathname: string) =>
  PUBLIC_PATHS.some((pattern) => pattern.test(pathname));

/** True when the request host is the app subdomain (app.example.com or
 *  app.localhost:3000). */
const isAppHost = (host: string) => {
  const hostname = host.split(':')[0];
  return hostname.split('.')[0] === APP_SUBDOMAIN;
};

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;
  const host = req.headers.get('host') ?? '';

  // API routes are shared by both hosts and must never be rewritten.
  const isInternal = pathname.startsWith('/api') || pathname.startsWith('/trpc');
  const onAppHost = isAppHost(host);

  // Work out what will actually be served before deciding anything else.
  const internalPath =
    !isInternal && onAppHost && !pathname.startsWith('/app')
      ? `/app${pathname === '/' ? '' : pathname}`
      : pathname;

  // Auth runs against the resolved path and *before* any rewrite is
  // returned. Returning the rewrite first skips this entirely, which left
  // every route on the app subdomain reachable while signed out.
  if (!isPublicPath(internalPath)) {
    await auth.protect();
  }

  if (internalPath !== pathname) {
    const url = req.nextUrl.clone();
    url.pathname = internalPath;
    return NextResponse.rewrite(url);
  }

  // Keep the workspace off the marketing host so there is one URL per page.
  if (!isInternal && !onAppHost && pathname.startsWith('/app')) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
