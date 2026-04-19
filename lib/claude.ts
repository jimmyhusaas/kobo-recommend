import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "placeholder",
});

// Default to Sonnet for MVP cost. Swap to claude-opus-4-6 if you want deeper analysis.
// If this model string is rejected, check https://docs.claude.com for current model IDs.
export const MODEL = "claude-sonnet-4-6";
