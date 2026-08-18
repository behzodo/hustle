import { serve } from "inngest/next";

import { inngest } from "@/inngest/client";
import { fastSiteFunction } from "@/inngest/fast";
import { codeAgentFunction } from "@/inngest/functions";

// The two lanes. `codeAgent` is the sandbox build a project's chat drives;
// `fastSite` is the templated one the sweep drives, one site per lead.
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    codeAgentFunction,
    fastSiteFunction,
  ],
});
