import { siteConfig } from "@/lib/site";
import { requireOnboarding } from "@/modules/onboarding/server/guard";
import { MetallicLogo } from "@/components/metallic-logo";
import { ProjectForm } from "@/modules/home/ui/components/project-form";
import { ProjectsList } from "@/modules/home/ui/components/projects-list";

// Structured data for the landing page. Rich results need an explicit
// price field, so the free tier is declared rather than left implied.
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: siteConfig.name,
  url: siteConfig.url,
  description: siteConfig.description,
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires JavaScript and a modern browser",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    url: `${siteConfig.url}/pricing`,
  },
  publisher: {
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url,
    logo: `${siteConfig.url}/icon.svg`,
  },
};

const Page = async () => {
  // Sends new accounts to the wizard before they hit the prompt box.
  await requireOnboarding();

  return (
    <div className="flex flex-col max-w-5xl mx-auto w-full">
      <script
        type="application/ld+json"
        // Static, locally authored object — no user input reaches this.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="space-y-6 py-[16vh] 2xl:py-48">
        <div className="flex flex-col items-center">
          {/* Biggest instance in the product, and the one place the shader
              has enough room to actually read as metal. */}
          <MetallicLogo size={56} priority className="hidden md:block" />
        </div>
        {/* Same display treatment as the landing, and the same accent rule:
            the italic marks the payoff. "Theirs" is the word the whole
            pitch turns on, so it carries it here too. */}
        <h1 className="headline-display font-display text-center text-balance text-3xl md:text-5xl lg:text-6xl leading-[0.95] tracking-[-0.03em]">
          Build{" "}
          <span className="headline-figure italic text-primary">theirs</span>{" "}
          before you call.
        </h1>
        {/* Set as a deck rather than body copy: same face as the headline at
            text optical size, so the two lines read as one setting. The
            headline already owns the accent, so the payoff here is marked by
            weight alone — no second italic competing with "theirs". */}
        {/* text-balance, not text-pretty: at two lines this is short enough
            to be balanced like a heading, and pretty only guards against a
            one-word orphan — it was happy to leave "it in minutes." stranded.
            The emphasised phrase is held together so the break can never land
            inside it. */}
        <p className="deck font-display text-muted-foreground text-center text-balance text-lg md:text-xl leading-[1.45] max-w-xl mx-auto">
          Describe the business. You&rsquo;ll have a live site with{" "}
          <span className="text-foreground whitespace-nowrap">
            their name on it
          </span>{" "}
          in minutes.
        </p>
        <div className="max-w-3xl mx-auto w-full">
          <ProjectForm />
        </div>
      </section>
      <ProjectsList />
    </div>
  );
};

export default Page;
