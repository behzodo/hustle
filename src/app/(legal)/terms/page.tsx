import type { Metadata } from "next";

import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `The terms you agree to when using ${siteConfig.name}.`,
  alternates: { canonical: "/terms" },
};

const LAST_UPDATED = "15 August 2026";

const Page = () => {
  return (
    <>
      <h1 className="text-4xl font-medium tracking-tight">Terms of Service</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Last updated: {LAST_UPDATED}
      </p>

      <p className="mt-8">
        These terms cover your use of {siteConfig.name}. By creating an account
        you agree to them. If you do not agree, do not use the service.
      </p>

      <h2>The service</h2>
      <p>
        {siteConfig.name} takes a written prompt and uses an AI agent to
        generate a working application, which it builds and runs in a temporary
        cloud sandbox. You can read the generated source, share the running app
        while its sandbox is alive, and refine it by sending further messages.
      </p>

      <h2>Your account</h2>
      <p>
        You need an account to build anything. Keep your credentials secure —
        you are responsible for activity under your account. You must be old
        enough to enter a contract where you live.
      </p>

      <h2>Credits and billing</h2>
      <ul>
        <li>Each build costs one credit.</li>
        <li>
          Your plan sets how many credits you get in a rolling 30-day period.
          Unused credits do not carry over.
        </li>
        <li>
          Paid plans renew automatically until cancelled. Cancelling stops the
          next renewal; it does not refund the current period.
        </li>
        <li>
          Where a free trial is offered, it converts to a paid subscription at
          the end of the trial unless you cancel first.
        </li>
        <li>
          Prices may change. We will give notice before a change affects an
          existing subscription.
        </li>
      </ul>

      <h2>Your content and generated code</h2>
      <p>
        You keep ownership of the prompts you write. As between you and us, the
        code the agent generates for you is yours to use, modify, and ship,
        including commercially.
      </p>
      <p>
        Generated code may resemble output produced for other users given
        similar prompts, and it may include or depend on third-party open source
        packages carrying their own licences. You are responsible for reviewing
        what you ship.
      </p>

      <h2>Acceptable use</h2>
      <p>You agree not to use the service to:</p>
      <ul>
        <li>Build or distribute malware, phishing pages, or spam tooling.</li>
        <li>Break the law or infringe someone else&rsquo;s rights.</li>
        <li>
          Mine cryptocurrency, run unrelated compute, or otherwise abuse the
          sandboxes.
        </li>
        <li>
          Attempt to bypass credit limits, rate limits, or access other
          users&rsquo; projects.
        </li>
      </ul>
      <p>
        We may suspend or close accounts that break these rules, and we may
        remove content we are legally required to remove.
      </p>

      <h2>AI output</h2>
      <p>
        The agent is automated and can be wrong. Generated code may contain
        bugs, security flaws, or logic that does not match what you asked for.
        Review and test anything before putting it in front of real users. You
        should not rely on generated output as professional advice.
      </p>

      <h2>Availability</h2>
      <p>
        We do not promise uninterrupted service. Sandboxes are temporary by
        design and are shut down after a period of inactivity — a preview URL
        will stop working once its sandbox ends. We may change or discontinue
        features.
      </p>

      <h2>Warranties and liability</h2>
      <p>
        The service is provided &ldquo;as is&rdquo;, without warranties of any
        kind to the extent the law allows. To the maximum extent permitted by
        law, our total liability arising from your use of the service is limited
        to the amount you paid us in the twelve months before the claim. We are
        not liable for indirect or consequential loss, including lost profits or
        lost data.
      </p>
      <p>
        Nothing here limits liability that cannot be limited under applicable
        law.
      </p>

      <h2>Termination</h2>
      <p>
        You can stop using the service and delete your account at any time. We
        may suspend or terminate access if you breach these terms or if we are
        required to by law.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. The date at the top shows the current
        version, and continuing to use the service after a change means you
        accept it.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms can go to{" "}
        <a href="mailto:legal@example.com">legal@example.com</a>.
      </p>
    </>
  );
};

export default Page;
