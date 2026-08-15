// `label` is the trade, not the task — these are the kinds of business you
// pitch, so the chip names the prospect and the input's placeholder supplies
// the verb. `summary` is the line that appears under the row on hover, so a
// click is never a surprise.
//
// Every prompt builds a real small-business site rather than an app clone:
// the thing you send a stranger to win the job. They all ask for a
// placeholder business name so the result is obviously theirs to rename.
export const PROJECT_TEMPLATES = [
  {
    label: "Dentist",
    summary: "Booking form, services, insurance, and team bios.",
    prompt:
      "Build a website for a local dental practice. Include a hero with the practice name and a Book Appointment call to action, a services grid (cleanings, whitening, implants, emergency care), a short about section with two dentist bios, accepted insurance logos as text, opening hours, patient reviews, and a booking form with date and time fields using local state. Warm, clean, trustworthy. Mobile first.",
  },
  {
    label: "Barber shop",
    summary: "Cut menu with prices, gallery, and a book-now block.",
    prompt:
      "Build a website for a barber shop. Include a bold hero with the shop name and a Book a Chair button, a price list of cuts and shaves, a photo gallery grid of finished cuts using placeholder blocks, barber profiles with their specialities, opening hours, and a booking section with barber and time selection in local state. Confident and masculine, high contrast. Mobile first.",
  },
  {
    label: "Plumber",
    summary: "Emergency call-out banner, services, and service area.",
    prompt:
      "Build a website for a local plumbing company. Lead with a 24/7 emergency call-out banner and a large tap-to-call phone number, then a services list (leaks, boilers, bathrooms, drains), a service area section listing nearby towns, trust signals like years in business and certifications, customer reviews, and a request-a-quote form using local state. Practical and reassuring. Mobile first.",
  },
  {
    label: "Café",
    summary: "Menu, hours, photos, and directions.",
    prompt:
      "Build a website for an independent café. Include a warm hero photo area with the café name and tagline, a menu split into coffee, food, and pastries with prices, an about section on where the beans come from, opening hours per day, a photo grid of the room and the food, and a find-us section with address and a map placeholder. Cosy, editorial, generous whitespace. Mobile first.",
  },
  {
    label: "Gym",
    summary: "Class timetable, membership tiers, and a trial signup.",
    prompt:
      "Build a website for a local gym. Include a high-energy hero with a Start Free Trial button, a weekly class timetable laid out as a grid, three membership tiers with prices and features, trainer profiles, a facilities list, member transformation quotes, and a free-trial signup form using local state. Bold type, strong contrast, lots of motion in the layout. Mobile first.",
  },
  {
    label: "Law office",
    summary: "Practice areas, attorney bios, and a consultation form.",
    prompt:
      "Build a website for a small law firm. Include a restrained hero with the firm name and a Request a Consultation button, practice areas as cards (family, property, employment, wills), attorney bios with credentials, a results or case-highlights section, client testimonials, and a confidential consultation form using local state. Serious, typographic, understated. Mobile first.",
  },
  {
    label: "Landscaper",
    summary: "Before-and-after gallery, services, and a quote form.",
    prompt:
      "Build a website for a landscaping and garden maintenance business. Include a hero with a seasonal offer, a services list (design, lawn care, patios, tree work), a before-and-after gallery using paired placeholder blocks with captions, a service area section, seasonal maintenance packages with prices, reviews, and a get-a-quote form using local state. Fresh and outdoorsy. Mobile first.",
  },
  {
    label: "Auto repair",
    summary: "Service pricing, diagnostics booking, and reviews.",
    prompt:
      "Build a website for an independent auto repair garage. Include a hero with the garage name and a Book a Service button, a service and pricing table (MOT, servicing, brakes, diagnostics), a why-choose-us row with warranty and turnaround, mechanic profiles, customer reviews, opening hours, and a booking form with vehicle make, model, and preferred date in local state. Clean and mechanical. Mobile first.",
  },
] as const;
