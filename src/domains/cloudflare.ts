import "server-only";

/**
 * Teaching the edge to answer on somebody else's domain.
 *
 * The sites are served by workers/sites from one bucket, and until now every
 * one of them lived at `<slug>.korvians.online` — our zone, our certificate,
 * one hostname pattern. A bought domain is none of those things: `joesgym.com`
 * is a name we do not own the zone for and cannot issue a certificate for by
 * having a wildcard.
 *
 * Cloudflare for SaaS is the piece that closes that. A custom hostname is
 * registered against our zone, the customer's DNS points at us, and Cloudflare
 * issues and renews a certificate for a domain that is not ours. The first
 * hundred are free on every plan and ten cents a month after that, which is
 * the whole cost of white-labelling.
 *
 * What it does not do is tell the Worker which site to serve. Cloudflare hands
 * over a request for `joesgym.com` and the Worker has only ever known how to
 * read a slug out of a subdomain. That mapping is written into the bucket by
 * ./map.ts, next to the files it points at.
 */

const API = "https://api.cloudflare.com/client/v4";

export const configured = () =>
  Boolean(process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ZONE_ID);

const config = () => {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const zone = process.env.CLOUDFLARE_ZONE_ID;

  if (!token || !zone) {
    throw new Error(
      "Custom domains are not configured. Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID.",
    );
  }

  return { token, zone };
};

/**
 * The host a bought domain is pointed at.
 *
 * A record inside our own zone, proxied, which is what makes it a valid
 * target for a customer's CNAME. Defaults to a well-known name under the
 * sites domain so a working deployment needs one environment variable rather
 * than two.
 */
export const fallbackOrigin = () =>
  process.env.SITES_FALLBACK_ORIGIN ?? `fallback.${process.env.SITES_DOMAIN ?? ""}`;

interface CloudflareResponse<T> {
  success?: boolean;
  errors?: { message?: string }[];
  result?: T;
}

const call = async <T>(
  path: string,
  init: RequestInit = {},
): Promise<CloudflareResponse<T>> => {
  const { token } = config();

  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const body = (await response.json().catch(() => ({}))) as CloudflareResponse<T>;

  if (!response.ok || body.success === false) {
    const reason =
      body.errors?.map((error) => error.message).filter(Boolean).join(", ") ||
      `${response.status}`;

    throw new Error(`Cloudflare refused the custom hostname: ${reason}`);
  }

  return body;
};

export interface CustomHostname {
  id: string;
  hostname: string;
  /** "pending", "active", "moved" — Cloudflare's own words. */
  status: string;
  /** Certificate state, which lags the hostname's by a minute or two. */
  sslStatus?: string;
}

interface HostnameResult {
  id: string;
  hostname: string;
  status?: string;
  ssl?: { status?: string };
}

const shape = (result: HostnameResult): CustomHostname => ({
  id: result.id,
  hostname: result.hostname,
  status: result.status ?? "pending",
  sslStatus: result.ssl?.status,
});

/**
 * Registers a bought domain against our zone.
 *
 * HTTP validation rather than TXT, because by the time this runs the DNS
 * already points here — ./porkbun.ts sets the records during the same
 * purchase. That makes the certificate issue on its own within a minute or
 * two, with nothing for the buyer to copy into a registrar they have never
 * heard of.
 */
export const attach = async (hostname: string): Promise<CustomHostname> => {
  const { zone } = config();

  const body = await call<HostnameResult>(`/zones/${zone}/custom_hostnames`, {
    method: "POST",
    body: JSON.stringify({
      hostname,
      ssl: {
        method: "http",
        type: "dv",
        settings: { min_tls_version: "1.2" },
      },
    }),
  });

  if (!body.result) throw new Error("Cloudflare accepted the hostname without an id.");

  return shape(body.result);
};

/** Where a hostname has got to. The screen polls this while a cert is issuing. */
export const status = async (id: string): Promise<CustomHostname | null> => {
  const { zone } = config();

  const body = await call<HostnameResult>(`/zones/${zone}/custom_hostnames/${id}`);
  return body.result ? shape(body.result) : null;
};

/**
 * Takes one off.
 *
 * Used when a purchase fails after the hostname was registered, so a domain
 * nobody owns is not left holding one of the hundred free slots.
 */
export const detach = async (id: string): Promise<void> => {
  const { zone } = config();

  await call(`/zones/${zone}/custom_hostnames/${id}`, { method: "DELETE" }).catch(
    () => undefined,
  );
};
