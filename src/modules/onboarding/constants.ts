// Shared by the wizard UI and the server validator, so the options a user
// can pick and the values the API accepts can never drift apart.
//
// Every question here has to earn its place by changing something we
// generate. Anything that would only sit in a database was cut.

// Signs the pitch and brands the preview they send.
export const ONBOARDING_EXPERIENCE = [
  { value: "first", emoji: "🌱", label: "This would be my first", hint: "We'll keep the guidance close" },
  { value: "some", emoji: "📈", label: "I've sold a few", hint: "You know the pitch, we'll speed it up" },
  { value: "pro", emoji: "🔥", label: "This is what I do", hint: "Straight to volume" },
] as const;

export const ONBOARDING_INDUSTRIES = [
  { value: "trades", emoji: "🔧", label: "Trades", hint: "Plumbers, electricians, builders" },
  { value: "food", emoji: "🍽️", label: "Food & drink", hint: "Restaurants, cafés, takeaways" },
  { value: "beauty", emoji: "💈", label: "Beauty & grooming", hint: "Salons, barbers, nails" },
  { value: "fitness", emoji: "🏋️", label: "Fitness", hint: "Gyms, studios, coaches" },
  { value: "health", emoji: "🦷", label: "Health", hint: "Dentists, clinics, therapists" },
  { value: "auto", emoji: "🚗", label: "Automotive", hint: "Garages, detailing, tyres" },
  { value: "property", emoji: "🏠", label: "Property", hint: "Agents, cleaners, landscapers" },
  { value: "events", emoji: "📸", label: "Events", hint: "Photographers, venues, caterers" },
  { value: "retail", emoji: "🛍️", label: "Local retail", hint: "Shops, boutiques, florists" },
  { value: "professional", emoji: "📊", label: "Professional", hint: "Accountants, law, consulting" },
] as const;

export const ONBOARDING_PRICE_BANDS = [
  { value: "under_500", label: "Under $500", hint: "Volume play — land a lot, fast" },
  { value: "500_1500", label: "$500 – $1,500", hint: "The usual small-business range" },
  { value: "1500_5000", label: "$1,500 – $5,000", hint: "Bigger builds, fewer clients" },
  { value: "over_5000", label: "$5,000+", hint: "Premium work and retainers" },
] as const;

// Sets the register of the site copy and the outreach message we write.
export const ONBOARDING_TONE = [
  { value: "direct", emoji: "🎯", label: "Straight to the point", hint: "No fluff, gets read on a phone" },
  { value: "local", emoji: "🤝", label: "Friendly and local", hint: "Neighbour talking to neighbour" },
  { value: "premium", emoji: "✨", label: "Polished and premium", hint: "Justifies a bigger invoice" },
] as const;

// Focus beats breadth on cold outreach, and a capped list keeps the first
// prospect search from returning noise.
export const ONBOARDING_MAX_INDUSTRIES = 4;

// Widened to string[]: the `as const` above makes these literal tuples,
// and .includes() on a literal tuple rejects a plain string argument.
export const EXPERIENCE_VALUES: string[] = ONBOARDING_EXPERIENCE.map((e) => e.value);
export const INDUSTRY_VALUES: string[] = ONBOARDING_INDUSTRIES.map((i) => i.value);
export const PRICE_BAND_VALUES: string[] = ONBOARDING_PRICE_BANDS.map((p) => p.value);
export const TONE_VALUES: string[] = ONBOARDING_TONE.map((t) => t.value);
