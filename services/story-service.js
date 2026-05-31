/**
 * Story Service
 *
 * Orchestrates story creation: validates usage limits, builds the runtime
 * context, calls the AI service, and returns the generated story.
 *
 * server.js hands off to this service — no Anthropic calls in the route handler.
 */

import { generateStory }       from "./ai-service.js";
import { validateStoryLimits } from "../validators/usage-validator.js";
import { buildRuntimeContext }  from "../story-engine/runtime/runtime-context.js";

/**
 * @param {{
 *   childProfile:  object,
 *   storyRequest:  object,
 *   subscription:  { limit: number, status: string },
 *   storyCount:    number,
 *   systemPrompt:  string,
 * }} opts
 * @returns {Promise<string>} Generated story text
 * @throws {Error} On limit breach or generation failure
 */
export async function createStory({
  childProfile,
  storyRequest,
  subscription,
  storyCount,
  systemPrompt,
}) {
  // Guard: check limits before spending any tokens
  validateStoryLimits({ storyCount, subscription });

  const runtimeContext = buildRuntimeContext({
    childProfile,
    storyRequest,
  });

  const story = await generateStory({
    systemPrompt,
    runtimeContext,
    mode: storyRequest.mode,
  });

  return story;
}

export default createStory;
