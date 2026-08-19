import "server-only";

/**
 * Porkbun, the registrar behind the domain shop.
 *
 * The user never sees this name. They pick an address on a lead's card, pay
 * once, and the domain is theirs — bought here, on our account, with our
 * balance, and pointed at their site before the dialog closes.
 *
 * Two things about this API shape the code below.
 *
 * Every call is a POST, including the ones that only read, and the credentials
 * travel in the JSON body rather than a header. That is not the modern shape
 * and it is not worth fighting: the whole client is four calls.
 *
 * And `domain/create` is the only call in this codebase that spends real money
 * the moment it succeeds. It takes the price in integer cents and rejects a
 * mismatch, which is a guard rather than an inconvenience — it means a price
 * that moved between the quote and the purchase fails loudly instead of
 * charging somebody a different number than the one they agreed to. It also
 * takes an idempotency key, which is what stops a retried request from buying
 * the same domain twice.
 */

const API = "https://api.porkbun.com/api/json/v3";

/** Registrations are refused past this, so a bad quote cannot become a bill. */
const MAX_COST_CENTS = 20_000;

export const configured = () =>
  Boolean(process.env.PORKBUN_API_KEY && process.env.PORKBUN_SECRET_KEY);

const credentials = () => {
  const apikey = process.env.PORKBUN_API_KEY;
  const secretapikey = process.env.PORKBUN_SECRET_KEY;

  if (!apikey || !secretapikey) {
    throw new PorkbunError(
      "The domain shop is not configured. Set PORKBUN_API_KEY and PORKBUN_SECRET_KEY.",
    );
  }

  return { apikey, secretapikey };
};

export class PorkbunError extends Error {
  constructor(
    message: string,
    /** Worth trying again — a timeout or a five-hundred rather than a refusal. */
    readonly retryable = false,
  ) {
    super(message);
    this.name = "PorkbunError";
  }
}

interface Envelope {
  status?: string;
  message?: string;
}

/**
 * One call.
 *
 * Porkbun answers 200 with `status: "ERROR"` for most refusals, so the HTTP
 * code alone is not the verdict and both have to be read.
 */
const call = async <T extends Envelope>(
  path: string,
  body: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): Promise<T> => {
  let response: Response;

  try {
    response = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ ...credentials(), ...body }),
    });
  } catch (cause) {
    throw new PorkbunError(`Could not reach the registrar: ${String(cause)}`, true);
  }

  if (!response.ok) {
    throw new PorkbunError(
      `The registrar answered ${response.status}: ${(await response.text()).slice(0, 200)}`,
      response.status >= 500 || response.status === 429,
    );
  }

  const parsed = (await response.json()) as T;

  if (parsed.status && parsed.status !== "SUCCESS") {
    throw new PorkbunError(parsed.message ?? "The registrar refused that.");
  }

  return parsed;
};

/** Proves the keys work. Used by the connections screen, not by the buy path. */
export const ping = async (): Promise<boolean> => {
  await call("/ping");
  return true;
};

export interface Availability {
  domain: string;
  available: boolean;
  /** What Porkbun charges for the first year, in cents. */
  costCents: number;
  /** What it renews at, in cents. Usually higher than the first year. */
  renewalCents?: number;
  /** Why it cannot be bought, when it cannot. */
  why?: string;
}

const cents = (price: unknown): number | undefined => {
  const value = Number(price);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : undefined;
};

/**
 * Is this address free, and what does it cost us?
 *
 * The price here is the wholesale one. What the user is shown is this plus the
 * markup — see ./price.ts, which is the only place the two are allowed to
 * meet.
 */
export const check = async (domain: string): Promise<Availability> => {
  const name = domain.trim().toLowerCase();

  const body = await call<
    Envelope & {
      response?: {
        avail?: string;
        price?: string;
        regularPrice?: string;
        renewalPrice?: string;
        premium?: string;
      };
    }
  >(`/domain/checkDomain/${encodeURIComponent(name)}`);

  const result = body.response ?? {};
  const available = result.avail === "yes";
  const costCents = cents(result.price) ?? cents(result.regularPrice);

  if (!available) {
    return { domain: name, available: false, costCents: 0, why: "Already taken" };
  }

  if (costCents === undefined) {
    return {
      domain: name,
      available: false,
      costCents: 0,
      why: "The registrar would not quote a price for that one",
    };
  }

  // A premium name is a four-figure sale that has nothing to do with what this
  // product is for, and quoting one on a plumber's card is how somebody
  // accidentally agrees to it.
  if (result.premium === "yes" || costCents > MAX_COST_CENTS) {
    return {
      domain: name,
      available: false,
      costCents,
      why: "That one is a premium name — try a different spelling",
    };
  }

  return {
    domain: name,
    available: true,
    costCents,
    renewalCents: cents(result.renewalPrice),
  };
};

export interface Registration {
  domain: string;
  /** What it actually cost us, in cents. */
  costCents: number;
  /** What was left on the account afterwards, when the registrar said. */
  balanceCents?: number;
}

/**
 * Buys it.
 *
 * `costCents` has to be the figure `check` just quoted; the registrar compares
 * them and refuses a mismatch. That is deliberate on their side and useful on
 * ours — a price that moved while somebody was typing their card details ends
 * as a failed purchase and a refund, not as a surprise on a statement.
 *
 * `idempotencyKey` must be the same string on every retry of the same
 * purchase, and different for every new one. The order id is exactly that, so
 * that is what the caller passes.
 */
export const register = async ({
  domain,
  costCents,
  years = 1,
  idempotencyKey,
  dryRun = false,
}: {
  domain: string;
  costCents: number;
  years?: number;
  idempotencyKey: string;
  /** Runs every check and buys nothing. */
  dryRun?: boolean;
}): Promise<Registration> => {
  const name = domain.trim().toLowerCase();

  if (costCents > MAX_COST_CENTS) {
    throw new PorkbunError("That domain costs more than this shop will buy.");
  }

  const body = await call<
    Envelope & {
      wouldSucceed?: boolean;
      cost?: number;
      balance?: number;
      sufficientFunds?: boolean;
    }
  >(
    `/domain/create/${encodeURIComponent(name)}`,
    {
      cost: costCents,
      agreeToTerms: "yes",
      registrationDurationYears: years,
      ...(dryRun ? { dryRun: true } : {}),
    },
    { "Idempotency-Key": idempotencyKey },
  );

  // Said plainly, because it is the one failure that is ours rather than the
  // customer's: they paid, and the float ran out. Whoever reads the log needs
  // to top up the registrar account, not debug a payment.
  if (body.sufficientFunds === false) {
    throw new PorkbunError(
      "The registrar account is out of funds. Top it up — the customer has already paid.",
      true,
    );
  }

  return {
    domain: name,
    costCents: typeof body.cost === "number" ? body.cost : costCents,
    balanceCents:
      typeof body.balance === "number" ? Math.round(body.balance * 100) : undefined,
  };
};

/**
 * Points the new domain at the site.
 *
 * An ALIAS at the apex rather than a CNAME, because a CNAME on a bare domain
 * is illegal in DNS and most registrars quietly refuse it. Porkbun's ALIAS is
 * their flattened stand-in and resolves the same way from outside.
 *
 * `www` gets its own record. A local business hands out their address by
 * saying it aloud, and roughly half the people who hear one type "www." in
 * front of it — a domain that only answers on the apex looks broken to them.
 */
export const pointAt = async (domain: string, target: string): Promise<void> => {
  const name = domain.trim().toLowerCase();

  await call(`/dns/create/${encodeURIComponent(name)}`, {
    type: "ALIAS",
    name: "",
    content: target,
    ttl: "600",
  });

  await call(`/dns/create/${encodeURIComponent(name)}`, {
    type: "CNAME",
    name: "www",
    content: target,
    ttl: "600",
  });
};
