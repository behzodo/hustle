/**
 * What a hustle is actually selling.
 *
 * The site was always the way in rather than the product. A cold email from a
 * stranger is deleted; a cold email with the business's own finished website in
 * it gets opened, and that is the only thing here that reliably buys a
 * conversation. What happens after that conversation is the choice on this
 * screen, and the three answers are worth very different money.
 *
 * Selling the site is one invoice. It is real money and it stops: a business
 * that bought a website in March is not a customer in April, so the whole
 * machine has to find and win somebody new every single month to stand still.
 *
 * Selling the service is the other end. The site is given away — it costs
 * pennies to build and its job was to get in the door — and what is charged for
 * every month is the AI that runs their front desk: answering the phone,
 * booking the work, replying to reviews. One shop won in March is still paying
 * in December, and the month after that starts from a higher floor.
 *
 * Only `normal` is wired to anything. `pro` and `hybrid` are picked, shown back
 * on the summary and then dropped; nothing downstream reads them yet.
 */

export type HustleMode = "normal" | "pro" | "hybrid";

/**
 * What the AI does for the shop once they are on the monthly.
 *
 * Written from the shop owner's side of the counter rather than ours — these
 * are the three things a small trade loses business to, not three features.
 * The freelancer reading this screen has to be able to say them out loud on a
 * doorstep.
 */
export const MODE_SERVICES = [
  {
    id: "phone",
    label: "Answers their phone",
    hint: "Every call picked up, including the ones after six",
  },
  {
    id: "diary",
    label: "Books their jobs",
    hint: "Straight into the diary, no callback needed",
  },
  {
    id: "reviews",
    label: "Replies to their reviews",
    hint: "Every review answered, good or bad",
  },
] as const;

export type ServiceId = (typeof MODE_SERVICES)[number]["id"];

/**
 * One slot of income, left to right over a year.
 *
 * `fee` is the invoice for the site — one payment, the tall one. `monthly` is
 * the subscription. `none` is a month this hustle earns nothing from a business
 * it has already won, which is the thing the picture is really for: it is the
 * difference between the three modes, and it is invisible in a sentence.
 */
export type Slot = "fee" | "monthly" | "none";

export interface HustleModeInfo {
  id: HustleMode;
  name: string;
  /** Sits under the name. What you are selling, in four words. */
  tagline: string;
  blurb: string;
  /** Twelve slots, one a month, so all three rows compare directly. */
  slots: Slot[];
  /** Whether the shop is on the monthly service. */
  monthly: boolean;
  /** The money, on one line. */
  money: string;
}

const repeat = (slot: Slot, count: number): Slot[] => Array(count).fill(slot);

export const HUSTLE_MODES: readonly HustleModeInfo[] = [
  {
    id: "normal",
    name: "Normal",
    tagline: "Sell them the site",
    blurb:
      "You build the site, they buy it, the job is done. One invoice per business — and next month you start again from nobody.",
    slots: ["fee", ...repeat("none", 11)],
    monthly: false,
    money: "One payment, then it ends",
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Give the site, sell the service",
    blurb:
      "The site is free — that is what gets you in the door. What they pay for every month is the AI running their front desk while they are on a job.",
    slots: repeat("monthly", 12),
    monthly: true,
    money: "Nothing upfront, paid every month after",
  },
  {
    id: "hybrid",
    name: "Hybrid",
    tagline: "Sell the site, then the service",
    blurb:
      "They pay for the site like Normal, and stay on the monthly for the phone, the diary and the reviews. The site pays for the work; the service pays the rent.",
    slots: ["fee", ...repeat("monthly", 11)],
    monthly: true,
    money: "Paid for the site, then paid every month",
  },
] as const;

export const DEFAULT_HUSTLE_MODE: HustleMode = "normal";

export const modeInfo = (id: HustleMode): HustleModeInfo =>
  HUSTLE_MODES.find((mode) => mode.id === id) ?? HUSTLE_MODES[0];
