import type { Metadata } from "next";

import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${siteConfig.name} collects, uses, and protects your data.`,
  alternates: { canonical: "/privacy" },
};

const LAST_UPDATED = "15 August 2026";

const Page = () => {
  return (
    <>
      <h1 className="text-4xl font-medium tracking-tight">Privacy Policy</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Last updated: {LAST_UPDATED}
      </p>

      <p className="mt-8">
        This policy explains what {siteConfig.name} (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;) collects when you use the service, why we collect it,
        and who else processes it on our behalf.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details.</strong> Your name, email address, and
          profile image, provided when you sign up.
        </li>
        <li>
          <strong>Prompts and generated projects.</strong> The messages you
          send, the code the agent writes in response, and the file contents of
          each project.
        </li>
        <li>
          <strong>Usage data.</strong> How many builds you have run in the
          current period, so we can apply your plan&rsquo;s limits.
        </li>
        <li>
          <strong>Billing details.</strong> Your plan and subscription status.
          Card numbers are handled by our payment processor and never reach our
          servers.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To run builds and show you the resulting apps.</li>
        <li>To keep your projects available when you return.</li>
        <li>To count credits against your plan and take payment.</li>
        <li>To investigate errors, abuse, and security incidents.</li>
      </ul>

      <p>
        We do not sell your personal data, and we do not use your prompts or
        generated code to train our own models.
      </p>

      <h2>Who else processes your data</h2>
      <p>
        Running the service requires a small number of subprocessors. Each
        receives only what it needs:
      </p>
      <ul>
        <li>
          <strong>Clerk</strong> — accounts, authentication, and subscription
          management.
        </li>
        <li>
          <strong>Stripe</strong> — payment processing, via Clerk.
        </li>
        <li>
          <strong>Neon</strong> — the database holding your projects, messages,
          and usage records.
        </li>
        <li>
          <strong>E2B</strong> — the sandboxes your apps are built and run in.
        </li>
        <li>
          <strong>OpenAI</strong> — the model that reads your prompt and writes
          the code.
        </li>
        <li>
          <strong>Inngest</strong> — queues and runs each build in the
          background.
        </li>
      </ul>

      <h2>Sandboxes and generated apps</h2>
      <p>
        Every build runs in a temporary sandbox with its own public URL. That
        URL is not guessable, but it is not access-controlled either — anyone
        holding the link can open the app while the sandbox is alive. Do not put
        secrets or personal data into a generated app you intend to share.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Projects, messages, and generated files are kept until you delete them
        or close your account. Sandboxes are short-lived and are torn down
        automatically. Usage counters reset on a rolling 30-day period. Billing
        records are retained as long as tax and accounting rules require.
      </p>

      <h2>Your rights</h2>
      <p>
        You can request a copy of your data, ask us to correct it, or ask us to
        delete it. Depending on where you live, you may also have the right to
        object to certain processing or to lodge a complaint with your local
        data protection authority. To make a request, contact us at the address
        below.
      </p>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit. Access to production systems is limited to
        people who need it. No service can promise perfect security, and we will
        notify affected users if a breach materially affects their data.
      </p>

      <h2>Changes</h2>
      <p>
        If we make a material change to this policy, we will update the date at
        the top and, where the change is significant, tell you directly.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy can go to{" "}
        <a href="mailto:privacy@example.com">privacy@example.com</a>.
      </p>
    </>
  );
};

export default Page;
