import Anthropic from "@anthropic-ai/sdk";

let cached: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (cached) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local (see .env.example).",
    );
  }
  cached = new Anthropic({ apiKey });
  return cached;
}

// Default model. Overridable via env so the deployed model can be bumped
// without a code change. Kept as a current Sonnet model — the analyzer is
// well within Sonnet's competence.
export const DEFAULT_MODEL =
  process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";
