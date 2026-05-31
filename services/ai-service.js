/**
 * AI Service
 *
 * Single abstraction layer for all Anthropic API calls.
 * server.js must never call Anthropic directly — route through here.
 *
 * Tracks estimated spend via budget-guard after each call.
 */

import Anthropic from "@anthropic-ai/sdk";
import { addSpend } from "../middleware/budget-guard.js";
import { RUNTIME_LIMITS } from "../config/runtime-limits.js";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || "",
});

// Rough cost estimate per output token (claude-sonnet-4-6 pricing)
// Update when Anthropic pricing changes.
const COST_PER_OUTPUT_TOKEN = 0.000015; // $15 / 1M tokens

const MODEL_SONNET = "claude-sonnet-4-6";
const MODEL_HAIKU  = "claude-haiku-4-5-20251001";

/**
 * Generate a story or any text via Claude.
 *
 * @param {{
 *   systemPrompt: string,
 *   userContent: string,
 *   maxTokens?: number,
 *   temperature?: number,
 *   model?: string,
 * }} opts
 * @returns {Promise<string>}
 */
export async function generateWithClaude({
  systemPrompt,
  userContent,
  maxTokens   = 3200,
  temperature = 0.82,
  model       = MODEL_SONNET,
}) {
  if (maxTokens > RUNTIME_LIMITS.maxTokensPerStory) {
    maxTokens = RUNTIME_LIMITS.maxTokensPerStory;
  }

  const response = await anthropic.messages.create({
    model,
    max_tokens:  maxTokens,
    temperature,
    system:      systemPrompt,
    messages: [{ role: "user", content: userContent }],
  });

  const outputTokens = response.usage?.output_tokens ?? 0;
  addSpend(outputTokens * COST_PER_OUTPUT_TOKEN);

  return response.content[0]?.text ?? "";
}

/**
 * Story-specific wrapper — picks token budget by mode.
 *
 * @param {{
 *   systemPrompt: string,
 *   runtimeContext: object,
 *   mode?: string,
 * }} opts
 * @returns {Promise<string>}
 */
export async function generateStory({ systemPrompt, runtimeContext, mode = "default" }) {
  const maxTokens = mode === "family-magic"
    ? Math.min(3800, RUNTIME_LIMITS.maxTokensPerStory)
    : 3200;

  return generateWithClaude({
    systemPrompt,
    userContent: JSON.stringify(runtimeContext),
    maxTokens,
  });
}

export { MODEL_SONNET, MODEL_HAIKU };
export default generateStory;
