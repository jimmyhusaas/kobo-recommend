import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "placeholder",
});

// claude-sonnet-4-6 pricing (USD per token)
// https://www.anthropic.com/pricing
const INPUT_COST_PER_TOKEN  = 3   / 1_000_000; // $3 / 1M
const OUTPUT_COST_PER_TOKEN = 15  / 1_000_000; // $15 / 1M

export function calcCost(inputTokens: number, outputTokens: number): number {
  return inputTokens * INPUT_COST_PER_TOKEN + outputTokens * OUTPUT_COST_PER_TOKEN;
}

export const MODEL = "claude-sonnet-4-6";
