"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Suspense, useState } from "react";
import { EyeIcon, CodeIcon, CrownIcon } from "lucide-react";

import type { Fragment, ProjectId } from "@/modules/projects/types";
import { useMessages } from "@/modules/projects/use-projects";
import { isPaidPlan } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { UserControl } from "@/components/user-control";
import { FileExplorer } from "@/components/file-explorer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

import { BlankCanvas } from "../components/blank-canvas";
import { FragmentWeb } from "../components/fragment-web";
import { ProjectHeader } from "../components/project-header";
import { EmptyWorkspace } from "../components/empty-workspace";
import { MessagesContainer } from "../components/messages-container";
import { ErrorBoundary } from "react-error-boundary";

interface Props {
  projectId: ProjectId;
};

export const ProjectView = ({ projectId }: Props) => {
  const { has } = useAuth();
  const hasProAccess = isPaidPlan(has);

  const [activeFragment, setActiveFragment] = useState<Fragment | null>(null);
  const [tabState, setTabState] = useState<"preview" | "code">("preview");

  // Same query and args MessagesContainer subscribes to, so this is the same
  // subscription rather than a second one — Convex hands both callers the one
  // cached result.
  const messages = useMessages(projectId);

  // undefined is still loading. Committing to a layout before the count is
  // known would flash the split panes on a brand-new hustle.
  if (messages === undefined) return null;

  if (messages.length === 0) return <BlankCanvas projectId={projectId} />;

  return (
    <div className="h-screen">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel
          defaultSize={35}
          minSize={20}
          className="flex flex-col min-h-0"
        >
          <ErrorBoundary fallback={<p>Project header error</p>}>
            <Suspense fallback={<p>Loading project...</p>}>
              <ProjectHeader projectId={projectId} />
            </Suspense>
          </ErrorBoundary>
          <ErrorBoundary fallback={<p>Messages container error</p>}>
            <Suspense fallback={<p>Loading messages...</p>}>
              <MessagesContainer
                projectId={projectId}
                activeFragment={activeFragment}
                setActiveFragment={setActiveFragment}
              />
            </Suspense>
          </ErrorBoundary>
        </ResizablePanel>
        <ResizableHandle className="hover:bg-primary transition-colors" />
        <ResizablePanel
          defaultSize={65}
          minSize={50}
        >
          <Tabs
            className="h-full gap-y-0"
            defaultValue="preview"
            value={tabState}
            onValueChange={(value) => setTabState(value as "preview" | "code")}
          >
            <div className="w-full flex items-center p-2 border-b gap-x-2">
              <TabsList className="h-8 p-0 border rounded-md">
                <TabsTrigger value="preview" className="rounded-md">
                  <EyeIcon /> <span>Demo</span>
                </TabsTrigger>
                <TabsTrigger value="code" className="rounded-md">
                  <CodeIcon /> <span>Code</span>
                </TabsTrigger>
              </TabsList>
              <div className="ml-auto flex items-center gap-x-2">
                {!hasProAccess && (
                  <Button asChild size="sm" variant="tertiary">
                    <Link href="/pricing">
                      <CrownIcon /> Upgrade
                    </Link>
                  </Button>
                )}
                <UserControl />
              </div>
            </div>
            {/* Both panes fall back to the empty workspace rather than
                rendering nothing: a draft from the wizard has no fragment at
                all, and two thirds of a blank screen reads as a failure. */}
            <TabsContent value="preview" className="min-h-0 flex-1">
              {activeFragment ? (
                <FragmentWeb data={activeFragment} />
              ) : (
                <EmptyWorkspace pane="preview" />
              )}
            </TabsContent>
            <TabsContent value="code" className="min-h-0 flex-1">
              {activeFragment?.files ? (
                <FileExplorer
                  files={activeFragment.files as { [path: string]: string }}
                />
              ) : (
                <EmptyWorkspace pane="code" />
              )}
            </TabsContent>
          </Tabs>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};
