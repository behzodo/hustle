import { createGroq } from "@ai-sdk/groq";

// Groq, not the AI Gateway, because the whole point of putting the support
// assistant on Groq is its latency — a help widget that thinks for three
// seconds gets closed before it answers.
export const GROQ_API_KEY = process.env.GROQ_API_KEY;

/** Overridable without a deploy, so a model can be swapped from the dashboard. */
export const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

export const isGroqConfigured = () => Boolean(GROQ_API_KEY);

/**
 * Null when there is no key, rather than throwing at import time — a missing
 * key must degrade the widget, not take down every route that imports this.
 */
export const getGroq = () =>
  GROQ_API_KEY ? createGroq({ apiKey: GROQ_API_KEY }) : null;
