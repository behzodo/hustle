import type { LocalizationResource } from "@clerk/types";

// Clerk's defaults label every pricing-table CTA "Switch to ...", so a card
// for another plan and a card offering annual billing read as the same
// action. Renaming them keeps one unambiguous verb per button.
//
// `switchPlan` renders on whichever plan card isn't active — that can be the
// cheaper or the pricier one — so it stays direction-neutral rather than
// saying "Upgrade"/"Downgrade".
export const clerkLocalization: LocalizationResource = {
  commerce: {
    switchPlan: "Choose this plan",
    switchToAnnual: "Save with annual billing",
    switchToMonthly: "Bill me monthly instead",
  },
};
