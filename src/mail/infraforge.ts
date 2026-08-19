import "server-only";

/**
 * Infraforge: where the sending addresses come from.
 *
 * Until now a pitch went out of the user's own Gmail, through Nango. That was
 * the right first answer — their name is on the bottom of the email, so their
 * address should be on the top of it — and it has one flaw that gets worse the
 * better the product works. Four hundred cold emails from a personal Gmail is
 * the exact signature of a compromised mailbox, and the account Google
 * suspends is the real one, with their real mail in it. There is no volume at
 * which that stops being true; there is only a volume at which it happens.
 *
 * So the sending address becomes something we sell them instead: a domain that
 * exists to send cold email, on mailboxes that exist to be burned, on
 * infrastructure that is not the place their children's school writes to.
 *
 * Three consequences worth knowing before reading the rest.
 *
 * These are *not* Google Workspace or Microsoft 365 accounts. Infraforge runs
 * its own mail servers on dedicated IPs, which is why sending is SMTP and
 * reading is IMAP rather than a vendor API — see smtp.ts and imap.ts. Every
 * transactional provider a developer would reach for first (Resend, Postmark,
 * SendGrid, Mailgun) forbids cold outreach in its acceptable-use policy and
 * suspends for it, so none of them is an option however pleasant the SDK.
 *
 * One workspace per user, not one per account. Infraforge scopes domains,
 * mailboxes and IP reputation to a workspace, so a user who sends badly should
 * damage only their own — which is the difference between one refund and every
 * customer's mail going to spam on the same afternoon.
 *
 * And it is resold rather than passed through at cost. This is the fee that
 * cannot be routed around: a freelancer who takes a bank transfer to dodge the
 * platform's share of an invoice still cannot send tomorrow's pitches without
 * the mailbox, because we are the ones holding it.
 */

/** The public API, as documented at api.infraforge.ai/public/swagger. */
const BASE = "https://api.infraforge.ai/public";

export const apiKey = () => process.env.INFRAFORGE_API_KEY;

export const configured = () => Boolean(apiKey());

/**
 * Thrown when Infraforge refuses.
 *
 * `retryable` separates the two failures that need opposite handling, the same
 * split as ProviderError in src/ai: a 429 or a 5xx is a bad second and the
 * same call will work later, while a 401 or a 402 is an answer — a rejected
 * key, or an account with no balance to buy a mailbox from — and retrying it
 * only delays telling somebody.
 */
export class MailboxError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "MailboxError";
  }
}

/**
 * One call.
 *
 * The key goes in `Authorization` raw, without a `Bearer` prefix — which is
 * unusual enough to be worth stating, because adding the prefix out of habit
 * produces a 401 that reads exactly like a wrong key.
 */
const call = async <T>(
  path: string,
  init: { method?: string; body?: unknown; query?: Record<string, string> } = {},
): Promise<T> => {
  const key = apiKey();

  if (!key) {
    throw new MailboxError(
      "Infraforge is not configured. Set INFRAFORGE_API_KEY.",
      0,
      false,
    );
  }

  const query = init.query ? `?${new URLSearchParams(init.query)}` : "";

  const response = await fetch(`${BASE}${path}${query}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: key,
      "Content-Type": "application/json",
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });

  if (!response.ok) {
    // Bounded: an error body from a proxy in front of an API can be a whole
    // HTML page, and this string ends up on a screen.
    const detail = (await response.text().catch(() => "")).slice(0, 300);

    throw new MailboxError(
      `Infraforge answered ${response.status}: ${detail}`,
      response.status,
      response.status === 429 || response.status >= 500,
    );
  }

  // A 204 on a delete has no body to parse, and JSON.parse("") throws.
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
};

/* -------------------------------------------------------------------------- */
/* Workspaces                                                                  */
/* -------------------------------------------------------------------------- */

export interface Workspace {
  id: string;
  accountId?: string;
  name: string;
  slug?: string;
  createdAt?: string;
}

export const listWorkspaces = async (): Promise<Workspace[]> => {
  const body = await call<Workspace[] | { data?: Workspace[] }>("/workspaces");
  return Array.isArray(body) ? body : (body?.data ?? []);
};

/**
 * A workspace for one user.
 *
 * `attachUniqueIp` is left off deliberately. A dedicated IP is the right
 * answer for somebody sending tens of thousands a month and the wrong one for
 * a freelancer sending ninety a day: an IP with no traffic on it has no
 * reputation, and no reputation is treated more harshly by a receiving server
 * than a shared one with a good history. Turn it on per user when their volume
 * earns it, not by default.
 */
export const createWorkspace = async (name: string): Promise<Workspace> =>
  await call<Workspace>("/workspaces", {
    method: "POST",
    body: { name, attachUniqueIp: false },
  });

/* -------------------------------------------------------------------------- */
/* Domains                                                                     */
/* -------------------------------------------------------------------------- */

export interface DomainOffer {
  domain: string;
  available: boolean;
  price?: number;
  minCreationPeriodMonths?: number;
}

export const checkDomains = async (domains: string[]): Promise<DomainOffer[]> => {
  const body = await call<DomainOffer[] | { data?: DomainOffer[] }>(
    "/check-domain-availability-bulk",
    { method: "POST", body: { domains } },
  );

  return Array.isArray(body) ? body : (body?.data ?? []);
};

/**
 * Who the domain is registered to.
 *
 * Real details, not ours. ICANN requires a registrant and a domain registered
 * to the platform on a user's behalf is a domain the user cannot take with
 * them — which matters more than it sounds, because these accumulate the
 * sending reputation their business runs on.
 *
 * `dmarcEmail` and `forwardingEmail` are separate on purpose: the first
 * receives authentication failure reports, the second is where anything sent
 * to the cold domain actually lands. Pointing both at the user's real inbox is
 * fine and is what the UI should default to.
 */
export interface DomainContact {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
  dmarcEmail?: string;
  forwardingEmail?: string;
}

export interface PurchasedDomain {
  id: string;
  domain: string;
  workspaceId?: string;
  status?: string;
}

/**
 * Buys domains into a workspace.
 *
 * Infraforge sets SPF, DKIM and DMARC itself as part of this, which is the
 * whole reason to buy through them rather than at a registrar and point the
 * records by hand. All three are mandatory for bulk sending now — a domain
 * missing any one of them does not land in spam, it is rejected at the door.
 */
export const buyDomains = async (
  workspaceId: string,
  domains: string[],
  contact: DomainContact,
): Promise<PurchasedDomain[]> => {
  const body = await call<PurchasedDomain[] | { data?: PurchasedDomain[] }>("/domains", {
    method: "POST",
    body: { workspaceId, domains, contactDetails: contact },
  });

  return Array.isArray(body) ? body : (body?.data ?? []);
};

export const listDomains = async (workspaceId?: string): Promise<PurchasedDomain[]> => {
  const body = await call<PurchasedDomain[] | { data?: PurchasedDomain[] }>("/domains", {
    ...(workspaceId ? { query: { workspaceId } } : {}),
  });

  return Array.isArray(body) ? body : (body?.data ?? []);
};

/* -------------------------------------------------------------------------- */
/* Mailboxes                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A mailbox, and the credentials to use it.
 *
 * The credentials only come back when they are asked for — see `listMailboxes`
 * — and everything that stores them has to treat them as what they are: a
 * password that sends email as somebody. They are never logged, never returned
 * to a browser, and live in Convex behind an internal query.
 */
export interface Mailbox {
  id: string;
  workspaceId?: string;
  email: string;
  domain?: string;
  firstName?: string;
  lastName?: string;
  /** "active" is the only one safe to send from. */
  status?: string;
  forwardingEmail?: string;
  credentials?: MailboxCredentials;
}

export interface MailboxCredentials {
  email?: string;
  password?: string;
  smtpHost?: string;
  smtpPort?: number;
  imapHost?: string;
  imapPort?: number;
}

/**
 * The credentials, normalised.
 *
 * The export names these fields in more than one shape depending on where they
 * came from — the CSV export and the API do not agree on casing — so this
 * reads whichever is present rather than trusting one. Ports fall back to the
 * implicit-TLS defaults, which is what Infraforge serves.
 */
export const credentialsOf = (mailbox: Mailbox) => {
  const raw = (mailbox.credentials ?? {}) as Record<string, unknown>;

  const pick = (...names: string[]) => {
    for (const name of names) {
      const value = raw[name];
      if (typeof value === "string" && value) return value;
      if (typeof value === "number") return String(value);
    }
    return undefined;
  };

  const password = pick("password", "smtpPassword", "imapPassword");

  if (!password) return null;

  return {
    user: pick("email", "username", "smtpUsername") ?? mailbox.email,
    password,
    smtpHost: pick("smtpHost", "smtp_host"),
    smtpPort: Number(pick("smtpPort", "smtp_port") ?? 465),
    imapHost: pick("imapHost", "imap_host"),
    imapPort: Number(pick("imapPort", "imap_port") ?? 993),
  };
};

/**
 * Suggests mailbox addresses on domains already owned.
 *
 * Generated rather than chosen because the name has to be a plausible person —
 * `hello@` and `info@` are read as a broadcast address by filters and by the
 * people receiving them, and the whole pitch depends on looking like one
 * person writing to another.
 */
export const generateMailboxes = async (args: {
  domains: string[];
  count: number;
  type?: "predefined" | "female" | "male" | "combo";
  forwardingEmail?: string;
}): Promise<{ email: string; firstName?: string; lastName?: string }[]> => {
  const body = await call<
    | { email: string; firstName?: string; lastName?: string }[]
    | { data?: { email: string; firstName?: string; lastName?: string }[] }
  >("/mailboxes/generate", {
    method: "POST",
    body: {
      domains: args.domains,
      count: args.count,
      type: args.type ?? "combo",
      ...(args.forwardingEmail ? { forwardingEmail: args.forwardingEmail } : {}),
    },
  });

  return Array.isArray(body) ? body : (body?.data ?? []);
};

/** Buys the generated mailboxes. This is the call that costs money. */
export const buyMailboxes = async (args: {
  workspaceId: string;
  mailboxes: { email: string; firstName?: string; lastName?: string }[];
  forwardingEmail?: string;
}): Promise<Mailbox[]> => {
  const body = await call<Mailbox[] | { data?: Mailbox[] }>("/mailboxes", {
    method: "POST",
    body: {
      workspaceId: args.workspaceId,
      mailboxes: args.mailboxes,
      ...(args.forwardingEmail ? { forwardingEmail: args.forwardingEmail } : {}),
    },
  });

  return Array.isArray(body) ? body : (body?.data ?? []);
};

/**
 * Lists mailboxes, optionally with the credentials to use them.
 *
 * `withCredentials` defaults to false and should stay that way anywhere the
 * answer is going to a screen. Ask for them once, on provisioning, store them,
 * and never pull them across the wire again to render a list.
 */
export const listMailboxes = async (args: {
  workspaceId?: string;
  withCredentials?: boolean;
} = {}): Promise<Mailbox[]> => {
  const body = await call<Mailbox[] | { data?: Mailbox[] }>("/mailboxes", {
    query: {
      ...(args.workspaceId ? { workspaceId: args.workspaceId } : {}),
      ...(args.withCredentials ? { with_credentials: "true" } : {}),
    },
  });

  return Array.isArray(body) ? body : (body?.data ?? []);
};
