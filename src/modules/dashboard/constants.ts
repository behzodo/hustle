// SAMPLE DATA — NOT REAL.
//
// Hustle stores projects, messages, fragments and credits. It does not yet
// store leads, outreach, invoices or payments, so the money and pipeline
// figures below have nothing to read from. They are here so the dashboard can
// be designed against realistic shapes, and every panel that uses them is
// marked "sample" in the UI. Delete this file the day the real tables land —
// an unmarked fake number on a revenue dashboard is worse than a blank one.

/**
 * Stand-ins for the two tiles that DO read real data, used only when a fresh
 * account would otherwise show a row of zeros. Both are badged "sample" in
 * the UI whenever they are the number on screen.
 */
export const SAMPLE_SITES_TOTAL = 34;
export const SAMPLE_CREDITS_LEFT = 76;

/** Weekly pipeline, in whole currency units. */
export const SAMPLE_PIPELINE = [
  { month: "Week 1", desktop: 1200, mobile: 400 },
  { month: "Week 2", desktop: 1850, mobile: 950 },
  { month: "Week 3", desktop: 1400, mobile: 1250 },
  { month: "Week 4", desktop: 2600, mobile: 1500 },
  { month: "Week 5", desktop: 2100, mobile: 1850 },
  { month: "Week 6", desktop: 3400, mobile: 2400 },
  { month: "Week 7", desktop: 2900, mobile: 2750 },
  { month: "Week 8", desktop: 4200, mobile: 3300 },
];

/** Sites shipped per day of the week. */
export const SAMPLE_SITES_BUILT = [
  { month: "Mon", desktop: 4 },
  { month: "Tue", desktop: 7 },
  { month: "Wed", desktop: 5 },
  { month: "Thu", desktop: 9 },
  { month: "Fri", desktop: 6 },
  { month: "Sat", desktop: 2 },
  { month: "Sun", desktop: 1 },
];

/** Where every lead currently sits. */
export const SAMPLE_FUNNEL = [
  { stage: "found", count: 128 },
  { stage: "built", count: 46 },
  { stage: "pitched", count: 31 },
  { stage: "replied", count: 12 },
  { stage: "signed", count: 5 },
];

export type LeadStage = "Found" | "Built" | "Pitched" | "Replied" | "Signed";

export interface Lead {
  id: string;
  name: string;
  trade: string;
  city: string;
  stage: LeadStage;
  value: number;
  found: string;
}

/** The most recent leads, newest first. */
export const SAMPLE_LEADS: Lead[] = [
  { id: "1", name: "Ridgeway Dental", trade: "Dentist", city: "Leeds", stage: "Replied", value: 2400, found: "12 Aug" },
  { id: "2", name: "Cut & Fade", trade: "Barber shop", city: "Leeds", stage: "Pitched", value: 900, found: "12 Aug" },
  { id: "3", name: "Hollis Plumbing", trade: "Plumber", city: "Bradford", stage: "Signed", value: 1800, found: "11 Aug" },
  { id: "4", name: "Bean & Bloom", trade: "Café", city: "Leeds", stage: "Built", value: 750, found: "11 Aug" },
  { id: "5", name: "Iron Yard Gym", trade: "Fitness", city: "Wakefield", stage: "Pitched", value: 3200, found: "10 Aug" },
  { id: "6", name: "Marsden Electrics", trade: "Electrician", city: "Leeds", stage: "Found", value: 1200, found: "10 Aug" },
  { id: "7", name: "The Clay Oven", trade: "Takeaway", city: "Bradford", stage: "Built", value: 850, found: "9 Aug" },
  { id: "8", name: "Verity Nails", trade: "Beauty", city: "Leeds", stage: "Replied", value: 600, found: "9 Aug" },
  { id: "9", name: "Northgate Tyres", trade: "Automotive", city: "Wakefield", stage: "Signed", value: 2100, found: "8 Aug" },
  { id: "10", name: "Aster Lettings", trade: "Property", city: "Leeds", stage: "Pitched", value: 4500, found: "8 Aug" },
  { id: "11", name: "Sundial Photography", trade: "Events", city: "Harrogate", stage: "Found", value: 1500, found: "7 Aug" },
  { id: "12", name: "Pennine Accounting", trade: "Professional", city: "Leeds", stage: "Built", value: 3800, found: "7 Aug" },
];

export const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
