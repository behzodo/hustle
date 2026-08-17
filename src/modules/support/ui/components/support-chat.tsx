"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowUpIcon, SparkleIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** Openers, so nobody has to face an empty box and think of a question. */
const SUGGESTIONS = [
  "How do credits work?",
  "Why is my dashboard showing sample data?",
  "How do I get paid through Stripe?",
];

export const SupportChat = ({ className }: { className?: string }) => {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error } = useChat({
    // Not the default /api/chat: the code agent owns that name in this app.
    // The endpoint moved onto a transport in v7 — a bare `api` option is
    // silently the wrong shape now.
    transport: new DefaultChatTransport({ api: "/api/support/chat" }),
  });

  const endRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  // Follow the stream. Without this the answer grows off the bottom edge and
  // reads as if nothing happened.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  const submit = (text: string) => {
    if (!text.trim() || busy) return;
    sendMessage({ text });
    setInput("");
  };

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="py-4">
            <div className="text-center">
              {/* Milled, like the New hustle plate and the support disc —
                  the mark that opens the assistant is the same material as
                  every other thing in the product you act on. The icon needs
                  a layer of its own; the plate's sheen is painted at z 1. */}
              <span className="metal-plate mx-auto flex size-10 items-center justify-center rounded-full">
                <SparkleIcon className="relative z-[2] size-5" weight="fill" />
              </span>
              <p className="font-display headline-display mt-3 text-lg tracking-[-0.02em]">
                Ask about Hustle
              </p>
              <p className="text-muted-foreground mt-1 text-sm text-balance">
                Credits, connections, how a build works — anything.
              </p>
            </div>

            {/* Staggered in: the openers arrive after the greeting has been
                read, which is the order you would say them out loud. */}
            <div className="mt-5 space-y-2">
              {SUGGESTIONS.map((suggestion, i) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => submit(suggestion)}
                  style={{ animationDelay: `${i * 70}ms` }}
                  className="hover:bg-muted hover:border-foreground/20 block w-full animate-in fade-in slide-in-from-bottom-2 rounded-xl border px-3 py-2.5 text-left text-sm fill-mode-both transition-colors duration-200"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex",
              message.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            <div
              className={cn(
                "animate-in fade-in slide-in-from-bottom-1 max-w-[85%] px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap duration-300",
                // The squared-off corner points back at its own side, the way
                // a speech bubble's tail does.
                message.role === "user"
                  ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md"
                  : "bg-muted rounded-2xl rounded-bl-md",
              )}
            >
              {/* Parts, not a flat string — the model's output arrives as an
                  ordered array, and only the text ones are renderable here. */}
              {message.parts.map((part, i) =>
                part.type === "text" ? (
                  <span key={`${message.id}-${i}`}>{part.text}</span>
                ) : null,
              )}
            </div>
          </div>
        ))}

        {status === "submitted" && (
          <div className="text-muted-foreground flex gap-1.5 px-1">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="bg-muted-foreground/60 size-1.5 animate-bounce rounded-full"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
        )}

        {error && (
          <p className="text-destructive px-1 text-sm">
            Could not reach the assistant. Email support@hustle.com and we will
            pick it up.
          </p>
        )}

        <div ref={endRef} />
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(input);
        }}
        className="border-t p-3"
      >
        <div className="bg-muted/60 focus-within:ring-foreground/15 flex items-center gap-2 rounded-full py-1 pr-1 pl-4 transition-shadow focus-within:ring-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask anything…"
            className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none"
          />
          <Button
            type="submit"
            size="icon-sm"
            disabled={!input.trim() || busy}
            className="metal-plate shrink-0 rounded-full bg-transparent transition-transform disabled:opacity-40 not-disabled:hover:scale-105"
          >
            <ArrowUpIcon className="relative z-[2] size-4" weight="bold" />
          </Button>
        </div>
      </form>
    </div>
  );
};
