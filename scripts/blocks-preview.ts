import { renderSite, TEMPLATE_NAMES, templateFor } from "@/blocks/render";
import type { SiteContent, TemplateName } from "@/blocks/types";
import { publishSite, siteUrl } from "@/publish";

/**
 * Publishes one demo site per template, so the four can be looked at.
 *
 *   npm run blocks:preview
 *
 * The samples are deliberately uneven. `plumbline` is given almost nothing —
 * a name, a trade and a number — because that is what a one-man operation's
 * listing actually contains, and the rule the templates are built on is that a
 * missing field removes its section rather than being filled in. A demo where
 * every business has a photo, a rating, six services and opening hours proves
 * the templates work on the business we will almost never meet.
 */

const SAMPLES: Record<TemplateName, SiteContent> = {
  forge: {
    business: {
      name: "Ironworks Strength & Conditioning",
      trade: "Gym",
      town: "Headingley, Leeds",
      phone: "0113 496 0182",
      address: "44 Otley Road, Headingley, Leeds LS6 2AL",
      mapsUrl: "https://www.google.com/maps/search/?api=1&query=53.8225,-1.5789",
      rating: 4.8,
      reviewCount: 214,
      photo:
        "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1600&q=70",
      hours: ["Mon–Fri  5:30am – 10pm", "Saturday  7am – 6pm", "Sunday  8am – 4pm"],
    },
    copy: {
      headline: "Lift heavy. Leave better.",
      subhead:
        "A barbell gym in Headingley with coaches on the floor every hour we are open. No contracts, no queues for the rack.",
      about:
        "We opened in 2011 with four platforms and a kettlebell rack. Fourteen years on we still coach every new member through their first eight weeks, because the people who stay are the ones who were shown how.",
      ctaLabel: "Book a free session",
      services: [
        { name: "Open gym", blurb: "Platforms, racks and a full dumbbell set to 60kg." },
        { name: "Strength coaching", blurb: "One to one, or in threes on Tuesday and Thursday." },
        { name: "Barbell club", blurb: "Olympic lifting, Sunday mornings, all levels." },
        { name: "Conditioning", blurb: "Thirty minutes, bikes and sleds, six until eight." },
      ],
      reviews: [
        { text: "Coaches actually watch you lift. First gym where I have not picked up an injury.", author: "Marcus T." },
        { text: "Been to a lot of gyms. This one has the best atmosphere by a mile.", author: "Priya S." },
      ],
      closing: "Fourteen years on Otley Road.",
    },
  },

  bloom: {
    business: {
      name: "Fern & Fig",
      trade: "Hair salon",
      town: "Stoke Newington, London",
      phone: "020 7946 0733",
      email: "hello@fernandfig.co.uk",
      address: "112 Church Street, London N16 0LA",
      mapsUrl: "https://www.google.com/maps/search/?api=1&query=51.5615,-0.0759",
      rating: 4.9,
      reviewCount: 168,
      photo:
        "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1400&q=70",
      hours: ["Tue–Fri  10am – 7pm", "Saturday  9am – 6pm", "Sun & Mon  Closed"],
    },
    copy: {
      headline: "Cut for how you actually wear it",
      subhead:
        "A small salon on Church Street. Two chairs, one colourist, and as long as your hair needs.",
      about:
        "We take four clients a day between us. That is not a shortage of chairs, it is the point — nobody is left under a dryer while somebody else is finished around them.",
      ctaLabel: "Book an appointment",
      services: [
        { name: "Cut & finish", blurb: "Consultation, wash, cut and a proper blow-dry." },
        { name: "Colour", blurb: "Full head, half head, or a gentle grow-out that needs no upkeep." },
        { name: "Balayage", blurb: "Hand-painted, and matched to how it will look in four months." },
        { name: "Treatments", blurb: "Bond repair and scalp work, added to any appointment." },
      ],
      reviews: [
        { text: "First time in years someone asked how I style it before picking up scissors.", author: "Amara O." },
        { text: "The colour has grown out beautifully. No harsh line at all.", author: "Jess W." },
      ],
      closing: "Church Street, since 2016.",
    },
  },

  // Deliberately sparse: a name, a trade, a number, three jobs. No photo, no
  // rating, no hours, no reviews. This is the common case.
  plumbline: {
    business: {
      name: "K. Ellerman Plumbing & Heating",
      trade: "Plumber",
      town: "Key Largo, FL",
      phone: "(305) 555 0182",
      address: "Tavernier, FL 33070",
    },
    copy: {
      headline: "Leaks, boilers and bathrooms across the Upper Keys.",
      subhead: "Twenty-two years on the islands. Same-day callouts, and a price before we start.",
      about:
        "Kevin has worked the Upper Keys since 2003. It is still him who answers the phone and him who turns up, which is why the diary is the honest limit on how much work we take.",
      ctaLabel: "Call for a quote",
      services: [
        { name: "Emergency callouts", blurb: "Burst pipes and blocked drains, seven days." },
        { name: "Water heaters", blurb: "Repair, replacement and annual servicing." },
        { name: "Bathroom fitting", blurb: "Full installs, start to finish, no subcontractors." },
      ],
      closing: "Licensed and insured in the State of Florida.",
    },
  },

  table: {
    business: {
      name: "The Copper Kettle",
      trade: "Café",
      town: "Hebden Bridge",
      phone: "01422 555 019",
      address: "3 Bridge Gate, Hebden Bridge HX7 8EX",
      mapsUrl: "https://www.google.com/maps/search/?api=1&query=53.7420,-2.0136",
      rating: 4.7,
      reviewCount: 402,
      photo:
        "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1600&q=70",
      hours: [
        "Monday  8am – 4pm",
        "Tuesday  8am – 4pm",
        "Wednesday  8am – 4pm",
        "Thursday  8am – 4pm",
        "Friday  8am – 5pm",
        "Saturday  8am – 5pm",
        "Sunday  9am – 3pm",
      ],
    },
    copy: {
      headline: "Bread out of the oven at seven.",
      subhead: "A café on Bridge Gate doing one bake a day, and coffee worth the walk up the hill.",
      about:
        "We bake in the morning and sell until it is gone, which on a good Saturday is by two. Everything on the board is made here except the cheese, and we will tell you exactly which farm that came from.",
      ctaLabel: "Call to reserve",
      services: [
        { name: "Sourdough", blurb: "One bake daily, out at seven" },
        { name: "Breakfast", blurb: "Served until eleven thirty" },
        { name: "Soup & sandwich", blurb: "Changes with what the market had" },
        { name: "Coffee", blurb: "Roasted in Leeds, ground per cup" },
        { name: "Cakes", blurb: "Whatever the oven had room for" },
      ],
      reviews: [
        { text: "The sourdough is the best I have had outside of London. Get there early.", author: "Tom H." },
        { text: "Proper coffee and they know your order by the third visit.", author: "Nadia K." },
      ],
      closing: "Bridge Gate, Hebden Bridge.",
    },
  },
};

const main = async () => {
  console.log("Rendering and publishing four demo sites.\n");

  for (const name of TEMPLATE_NAMES) {
    const content = SAMPLES[name];
    const slug = `demo-${name}`;
    const target = siteUrl(slug);

    const { files, bytes, template } = renderSite(content, {
      template: name,
      siteUrl: target,
    });

    await publishSite(slug, files);

    const routed = templateFor(content.business.trade);
    const agrees = routed === name ? "" : `  (trade routes to "${routed}")`;

    console.log(
      `${template.padEnd(11)} ${String(bytes).padStart(6)} bytes  ${target}${agrees}`,
    );
  }

  console.log("\nRouting check:");
  for (const trade of [
    "Gym",
    "Barber shop",
    "Hair salon",
    "Nail salon",
    "Plumber",
    "Electrician",
    "Café",
    "Pizza restaurant",
    "Dentist",
    "Dog groomer",
  ]) {
    console.log(`  ${trade.padEnd(20)} -> ${templateFor(trade)}`);
  }
};

void main();
