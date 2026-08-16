import type { ProjectId } from "./types";

/**
 * Kick off an agent run for a project.
 *
 * A Convex mutation is a deterministic transaction and cannot make network
 * calls, so the Inngest event cannot be sent from inside `projects.create` or
 * `messages.send`. The write lands first, then this fires the run.
 *
 * Deliberately not awaited-into-the-UI as a failure: the message is already
 * saved either way, and a failed dispatch should not look like a failed send.
 */
export const startAgentRun = async (args: {
  projectId: ProjectId;
  value: string;
}) => {
  const res = await fetch("/api/agent/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });

  if (!res.ok) {
    throw new Error("Could not start the build");
  }
};
