import { auth } from "@clerk/nextjs/server";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";

import { getGroq, GROQ_MODEL } from "@/lib/groq";
import { SUPPORT_PROMPT } from "@/modules/support/prompt";

// Model inference is slow relative to a request handler's default budget, and
// this one streams — the ceiling has to clear the longest answer.
export const maxDuration = 60;

export async function POST(req: Request) {
  // Signed in only. The route spends tokens on every call, so leaving it open
  // is a bill anyone on the internet can run up.
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const groq = getGroq();
  if (!groq) {
    return Response.json(
      { error: "Support assistant is not configured. Set GROQ_API_KEY." },
      { status: 503 },
    );
  }

  const { messages }: { messages: UIMessage[] } = await req.json();

  // Bounded: a widget conversation that runs long is a conversation that
  // should have become an email, and the whole history is re-sent every turn.
  const recent = messages.slice(-20);

  const result = streamText({
    model: groq(GROQ_MODEL),
    system: SUPPORT_PROMPT,
    messages: await convertToModelMessages(recent),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
