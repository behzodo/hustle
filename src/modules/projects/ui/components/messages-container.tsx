import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";

import { api } from "@/../convex/_generated/api";
import type { Fragment, ProjectId } from "@/modules/projects/types";

import { MessageCard } from "./message-card";
import { MessageForm } from "./message-form";
import { MessageLoading } from "./message-loading";

interface Props {
  projectId: ProjectId;
  activeFragment: Fragment | null;
  setActiveFragment: (fragment: Fragment | null) => void;
};

export const MessagesContainer = ({ 
  projectId,
  activeFragment,
  setActiveFragment
}: Props) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastAssistantMessageIdRef = useRef<string | null>(null);

  // Reactive: when the agent writes a message, Convex pushes it here. The
  // 2-second refetchInterval this replaces was polling for exactly this.
  const messages = useQuery(api.messages.list, { projectId });

  useEffect(() => {
    const lastAssistantMessage = messages?.findLast(
      (message) => message.role === "ASSISTANT"
    );

    if (
      lastAssistantMessage?.fragment &&
      lastAssistantMessage._id !== lastAssistantMessageIdRef.current
    ) {
      setActiveFragment(lastAssistantMessage.fragment);
      lastAssistantMessageIdRef.current = lastAssistantMessage._id;
    }
  }, [messages, setActiveFragment]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView();
  }, [messages?.length]);

  // undefined is "still loading" in convex/react, distinct from an empty
  // project. Rendering the composer under a spinner would let someone queue
  // a message before the history they are replying to has arrived.
  if (messages === undefined) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
        Loading messages…
      </div>
    );
  }

  const lastMessage = messages[messages.length - 1];
  const isLastMessageUser = lastMessage?.role === "USER";

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="pt-2 pr-1">
          {messages.map((message) => (
            <MessageCard
              key={message._id}
              content={message.content}
              role={message.role}
              fragment={message.fragment}
              createdAt={message._creationTime}
              isActiveFragment={activeFragment?._id === message.fragment?._id}
              onFragmentClick={() => setActiveFragment(message.fragment)}
              type={message.type}
            />
          ))}
          {isLastMessageUser && <MessageLoading />}
          <div ref={bottomRef} />
        </div>
      </div>
      <div className="relative p-3 pt-1">
        <div className="absolute -top-6 left-0 right-0 h-6 bg-gradient-to-b from-transparent to-background pointer-events-none" />
        <MessageForm projectId={projectId} />
      </div>
    </div>
  );
};
