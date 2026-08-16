import { Suspense } from "react";
import type { Metadata } from "next";
import { ErrorBoundary } from "react-error-boundary";

import { appUrl } from "@/lib/site";
import { requireOnboarding } from "@/modules/onboarding/server/guard";
import type { ProjectId } from "@/modules/projects/types";

import { ErrorState } from "@/components/error-state";
import { ProjectView } from "@/modules/projects/ui/views/project-view";

interface Props {
  params: Promise<{
    projectId: string;
  }>
};

// Projects are private and auth-gated — keep them out of search results and
// out of any preview a shared link might generate.
export const metadata: Metadata = {
  title: "Project",
  robots: { index: false, follow: false, nocache: true },
};

const Page = async ({ params }: Props) => {
  await requireOnboarding();

  const { projectId } = await params;

  // No prefetch: the project and its messages are live Convex queries now,
  // and they subscribe from the client rather than being hydrated in.
  return (
    <>
      {/* This boundary sits below the route's error.tsx, so without a real
          fallback here a failed project would never reach it. */}
      <ErrorBoundary
        fallback={
          <ErrorState
            eyebrow="error · project unavailable"
            title="This project didn't load."
            description="The project exists, but its messages and files couldn't be fetched. Reloading usually settles it."
            target={projectId}
            steps={[
              { label: "project requested", detail: "ok" },
              { label: "loading history", detail: "failed", failed: true },
            ]}
            actions={[
              { label: "Back to projects", href: appUrl("/") },
            ]}
          />
        }
      >
        <Suspense fallback={<p>Loading Project...</p>}>
          <ProjectView projectId={projectId as ProjectId} />
        </Suspense>
      </ErrorBoundary>
    </>
  );
};
 
export default Page;
