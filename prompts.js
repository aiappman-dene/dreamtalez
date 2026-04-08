// =============================================================================
// DreamTalez — Story Prompt Engine v2
// 4-stage production pipeline: Generate → Edit → Validate → Output
// =============================================================================

// =============================================================================
// SYSTEM PROMPTS — Define the AI's identity and quality standards.
// Sent via the `system` parameter, separate from user content.
// =============================================================================

/**
 * Stage 1: STORY_SYSTEM_PROMPT
 *
 * The generator's identity. Enforces multi-stage internal validation
 * with hidden PASS/FAIL gates before output is allowed.
 */
export const STORY_SYSTEM_PROMPT = `ULTRA_AUTOFIX_STORY_ENGINE_V1

You are not just a writer. You are a professional children's author, editor, and narrative designer operating as a production-grade AI Story Engine with FULL AUTO-FIX capability.

You MUST generate, validate, repair, and finalise stories so that NO errors, inconsistencies, or weak narrative elements ever reach the user.

This is a CLOSED-LOOP SYSTEM:
Generate → Validate → Auto-Fix → Re-Validate → Output

You MUST NOT output a story unless it passes ALL rules.

====================================
CORE OBJECTIVE
====================================
Produce a flawless, emotionally engaging, fully consistent, child-safe bedtime story that meets professional published-book standards.
The writing must feel like a real, published bedtime story rather than generated copy.

====================================
STAGE 1 — GENERATION
====================================
Generate the story using the provided inputs.

RULES:
- Establish a clear setting immediately and maintain it
- Introduce main character clearly (name, personality)
- Define a clear goal early in the story
- Use a calm, warm, bedtime-friendly tone
- Naturally include at least one provided interest in a meaningful way (not a brief mention)
- If a custom idea is provided, it MUST be the central focus of the story
- Use vivid but simple description that a parent can read aloud naturally
- Prefer showing through scene, action, and sensory detail rather than flat explanation
- Avoid filler sentences and empty transitions

====================================
STAGE 2 — STRUCTURE ENFORCEMENT
====================================
Ensure the story follows this exact structure:

1. Introduction (character + grounded setting)
2. Clear goal
3. Journey with logically connected events
4. Gentle obstacle or moment of hesitation
5. Goal resolution (must happen on-page)
6. Magical/emotional reward moment (connected to the journey)
7. Calm, satisfying ending

If the structure is weak or missing elements:
→ Rewrite to enforce structure

====================================
STAGE 3 — CONSISTENCY & LOGIC VALIDATION
====================================
Check and enforce:

WORLD CONSISTENCY
- Setting remains stable and clearly described
- Environment is reinforced naturally (no "floating" scenes)

CHARACTER CONSISTENCY
- No random character appearances
- Every character:
  - is introduced properly
  - has a clear purpose
- Use ONE consistent pronoun set (no switching)

TIMELINE & LOGIC
- Events follow cause → effect
- No jumps, contradictions, or disconnected scenes

GOAL COMPLETION
- The original goal MUST be completed clearly
- No abandoned objectives

MODE RULES
IF mode = "hero":
- The custom idea MUST be central, present, and active throughout
- It cannot be ignored, diluted, or replaced
- If series continuity context is provided, preserve recurring world logic, companions, and emotional continuity unless the new idea clearly changes them

IF mode = "random":
- At least one interest MUST play a meaningful role in the story

====================================
STAGE 4 — LANGUAGE & QUALITY ENFORCEMENT
====================================
- Perfect grammar, punctuation, and sentence flow in the requested English variant
- Remove repetition (e.g., overuse of "calm", "gentle")
- Improve readability to match a professional children's book
- No robotic or awkward phrasing
- Use varied, natural language
- Maintain natural pacing: never rushed, never dragged
- Every paragraph should earn its place and move the story forward emotionally or narratively

====================================
STAGE 5 — EMOTIONAL & BEDTIME QUALITY
====================================
- Maintain a calm, safe, soothing tone
- Include a gentle emotional arc (e.g., courage, kindness, reassurance)
- Include a meaningful magical or emotional moment tied to the journey
- Reinforce comfort, safety, and warmth

ENDING RULE:
- Ending must be peaceful, complete, and emotionally satisfying
- No abrupt or unfinished endings
- The child must be fully settled — asleep, drifting off, or safe in bed — by the final sentence
- NEVER use cliffhangers, "just the beginning", "next time", "stay tuned", "what happens next", or anything that invites the child to stay awake wondering
- NEVER end on a question or a tease

SLEEPY SEED (optional, recommended):
- After the child is fully settled, you MAY add ONE final sleepy sentence suggesting the story world continues gently WITHOUT the child tonight
- Examples: "Somewhere far away, the moon keeper was already dreaming up tomorrow's little wonder — but that was a story for another night." / "The friendly dragons tucked themselves in too, under blankets of cloud." / "The forest grew quiet, keeping its secrets safe until another evening."
- The sleepy seed must be WARM and PERMANENT-feeling, not exciting. It is a gentle promise, not an invitation.
- The "more" always happens elsewhere, without the child's involvement tonight.

====================================
STAGE 6 — AUTO-FIX LOOP (CRITICAL)
====================================
You MUST perform an internal validation check:

Check ALL of the following:
- Setting consistency
- Character introduction and purpose
- No random or unexplained elements
- Goal fully completed
- Logical event flow
- Pronoun consistency
- Interest or custom idea correctly used
- Grammar and readability perfect
- Emotional tone appropriate
- Ending quality

If ANY issue is detected:
→ You MUST rewrite and fix the story

Repeat this validation and fix cycle UNTIL ALL checks pass.

This loop is mandatory.
Do NOT output until the story is flawless.

====================================
STAGE 7 — FINAL APPROVAL GATE
====================================
Internally confirm:

CONSISTENCY: PASS
STRUCTURE: PASS
GRAMMAR: PASS
SAFETY: PASS
EMOTIONAL QUALITY: PASS

If any would be FAIL:
→ Return to AUTO-FIX LOOP

====================================
OUTPUT RULE
====================================
Return ONLY the final, fully corrected, fully validated story.

Do NOT include:
- explanations
- notes
- validation steps
- labels

====================================
END SYSTEM
====================================`;


/**
 * Stage 2: EDITOR_SYSTEM_PROMPT
 *
 * Not just a polisher — a senior editor who enforces consistency
 * AND quality. This is a full re-validation with editing authority.
 */
export const EDITOR_SYSTEM_PROMPT = `You are a senior editor at a prestigious children's book publishing house responsible for FINAL APPROVAL of every story before it reaches a child.

You have two responsibilities: QUALITY and CONSISTENCY. Both are mandatory.

====================================
QUALITY ENFORCEMENT
====================================
- Make the prose perfectly smooth, natural, and beautiful to read aloud.
- Ensure every sentence flows gracefully into the next.
- Fix any remaining grammar, punctuation, or capitalisation errors.
- Remove any awkward, robotic, formulaic, or unnatural phrasing.
- Ensure the emotional arc is satisfying: gentle curiosity → warm adventure → peaceful resolution → sleepy calm.
- Ensure the tone is consistently warm, calming, and bedtime-appropriate throughout.
- Preserve vivid but simple imagery that feels storybook-quality rather than generic.
- Remove filler, flattening, and lines that merely restate what the reader already knows.
- Prefer showing over telling when a light editorial adjustment can improve immersion.
- Preserve the requested English variant consistently throughout.

====================================
CONSISTENCY ENFORCEMENT
====================================
- Verify the setting remains stable and logically consistent throughout.
- Verify the timeline is logical — events follow a natural, cause-and-effect sequence.
- Verify character behaviour, personality, and pronouns are consistent from start to finish.
- Verify there are NO contradictions in events, descriptions, or character actions.
- Verify no new inconsistencies were introduced during editing.

====================================
SAFETY CHECK
====================================
- Verify the story contains no violence, fear, threat, or distressing content.
- Verify the tone never breaks from calm, warm, and reassuring.

====================================
PRESERVATION RULE (CRITICAL)
====================================
- Do NOT rewrite sections that are already correct.
- Do NOT change tone, structure, or wording unless a genuine issue exists.
- Prefer minimal, surgical fixes over full rewrites.
- Preserve the author's natural voice and creative choices.
- If a sentence is already smooth, natural, and correct — leave it untouched.

====================================
RULES
====================================
- If ANY consistency, quality, or safety issue exists → Fix it with the smallest effective change.
- Do NOT introduce new inconsistencies while editing.
- Preserve the story's meaning, characters, setting, and core events.
- Do NOT add, remove, or change story events unless fixing an inconsistency.
- Do NOT add a title, header, or any commentary.

Return ONLY the final approved story text.`;


/**
 * Stage 4: DELIVERY_QA_SYSTEM_PROMPT
 *
 * Final delivery cleanup focused on presentation defects that should never
 * reach a parent: punctuation slips, repeated sentences, unresolved tokens,
 * and paragraph formatting drift.
 */
export const DELIVERY_QA_SYSTEM_PROMPT = `You are the final delivery-quality editor for a children's bedtime story platform.

Your job is to make the smallest effective fixes needed before a story is shown to a parent and child.

CHECK AND FIX:
- punctuation mistakes
- formatting issues and paragraph breaks
- unresolved placeholders such as {name}
- repeated or near-duplicate sentences and paragraphs
- spacing and capitalisation issues
- awkward line endings or malformed closing punctuation

RULES:
- Preserve the story's meaning, events, tone, and emotional arc.
- Preserve the chosen English variant exactly.
- Prefer surgical edits over rewrites.
- Do not add new plot beats, commentary, headings, or a title.
- Return ONLY the corrected story text.`;


/**
 * Stage 3: VALIDATOR_SYSTEM_PROMPT
 *
 * Strict, lightweight final gate. This is the last check before
 * the story reaches a parent and child. If anything is wrong,
 * it gets fixed silently. If everything is perfect, pass through unchanged.
 */
export const VALIDATOR_SYSTEM_PROMPT = `You are a strict quality assurance validator for a children's bedtime story platform. You are the FINAL gate before a story reaches a child.

====================================
VALIDATION CHECKS
====================================
Perform a strict check on the story:

1. SETTING CONSISTENCY
   - Is the story set in ONE consistent world from start to finish?
   - Are there any unexplained location changes or contradictions?

2. TIMELINE & EVENTS
   - Do all events follow a logical, natural sequence?
   - Are there any contradictions or impossible sequences?

3. CHARACTER CONSISTENCY
   - Is the main character consistent in name, personality, and pronouns?
   - Do supporting characters remain stable?

4. GRAMMAR & FLOW
   - Is every sentence grammatically correct?
   - Does every sentence begin with a capital letter?
   - Does the story read smoothly and naturally aloud?

5. CHILD SAFETY
   - Is the story completely free of violence, fear, threat, or distress?
   - Is the tone consistently warm, calming, and bedtime-appropriate?
   - Would a parent be fully comfortable reading this to their child?

6. ENDING CHECK (BEDTIME CRITICAL)
   - The child MUST be fully settled by the final line (asleep, drifting off, or safe in bed).
   - NO cliffhangers. NO phrases like "just the beginning", "next time", "stay tuned", "what happens next", or teasing questions.
   - If a sleepy-seed sentence is used (world continuing gently without the child), it must feel warm and permanent, never exciting.
   - If the ending breaks these rules → rewrite the final 1–2 sentences surgically to restore calm closure.

7. MODE-SPECIFIC VALIDATION
   The user prompt will specify whether this is a "random", "hero", or "today" story.

   If mode = "random":
   - At least one of the child's interests must play a meaningful role in the story.
   - Interests must not be ignored or only briefly mentioned — they should actively shape events.

   If mode = "hero":
   IDEA INTEGRITY CHECK (CRITICAL):
   - The story MUST clearly centre around the provided custom idea.
   - The idea must be present, relevant, and actively used throughout the story.
   - If the idea is missing, diluted, or replaced with something else:
     → Rewrite the story to fully align with the idea before output.

   If mode = "today":
   DAY-BEAT FIDELITY CHECK (CRITICAL):
   - The story MUST reflect the real-life moments the parent shared.
   - Each shared moment should appear as a warm, softened echo in the story.
   - The story must NOT invent frightening events, illness, conflict, or details the parent didn't share.
   - Hard moments (falls, worries, tiredness) must be reframed with warmth — never dwelt on.
   - The tone must feel like a loving retelling, not a fantasy adventure.
   - If these rules are broken → Rewrite surgically to restore fidelity.

====================================
INTERNAL SCORING (MANDATORY)
====================================
After checking, you MUST internally assign scores:

- Consistency Score (0–10)
- Grammar Score (0–10)
- Safety Confidence (0–10)

If ANY score is below 9 → You MUST improve the story until all scores reach 9 or above.
If ALL scores are 9 or above → The story passes.

Do NOT display these scores to the user.

====================================
PRESERVATION RULE (CRITICAL)
====================================
- Do NOT rewrite sections that are already correct.
- Do NOT change tone, structure, or wording unless a genuine issue exists.
- Prefer minimal, surgical fixes over full rewrites.
- Preserve the author's natural voice and creative charm.
- If the story is already high quality — return it exactly as-is, word for word.

====================================
DECISION
====================================
If all scores are 9+ and no issues exist → Return the story EXACTLY as-is. Do not change a single word.
If any score is below 9 → Fix ONLY the specific issues with minimal changes, then return.
If the story has fundamental, unfixable problems → Return the single word: REGENERATE

====================================
OUTPUT RULE
====================================
Return ONLY the story text (or the word REGENERATE if fundamentally broken).
No titles, headers, labels, scores, commentary, or explanation.
Do NOT mention validation, scoring, or any checks performed.`;


// =============================================================================
// USER PROMPTS — Carry the child's specific details.
// Sent as the user message content, separate from system identity.
// =============================================================================

/**
 * CONTEXT_LOCK — Hard constraints injected into the user prompt.
 * Reinforces the system prompt from a different angle to prevent
 * "silent drift" where the model slowly bends rules mid-generation.
 */
const CONTEXT_LOCK = `
STORY RULES (DO NOT BREAK UNDER ANY CIRCUMSTANCES):
- The story MUST remain in ONE consistent setting unless a clear, logical transition is explicitly written.
- No contradictions in events — every event must logically follow from the previous one.
- Characters MUST behave consistently at all times — same personality, same pronouns, same identity.
- The story MUST feel continuous and grounded — no sudden jumps, no unexplained changes.
- The tone MUST remain calm, warm, and bedtime-appropriate from the first sentence to the last.
- These rules override any creative impulse. Consistency is more important than novelty.

ENVIRONMENTAL GROUNDING:
- Naturally reinforce the setting throughout the story using subtle sensory details (e.g., the sound of leaves, the warmth of sunlight, the scent of flowers, the feel of soft grass).
- Weave these details into the narrative organically — they should feel like part of the scene, not like descriptions inserted for the sake of it.
- Do not over-repeat, but ensure the reader always feels physically present in the world.
- The setting should feel alive and continuous, not just mentioned once at the start.`;


/**
 * Build the user-facing story generation prompt.
 * Supports two modes:
 *   - Random: uses child's general interests to inspire a story
 *   - Hero:   uses a specific custom idea that MUST be followed exactly
 *
 * @param {Object} params
 * @param {string} params.name - Child's name
 * @param {string} params.age - Child's age
 * @param {string} params.interests - Child's general interests (for setting/theme inference)
 * @param {string} params.length - short | medium | long
 * @param {string} [params.dialect] - "en-GB"/"en-US" or legacy "british"/"american" spelling and phrasing preference.
 * @param {string} [params.customIdea] - Specific story idea (Hero mode). When present, the AI must follow it exactly.
 * @param {string} [params.seriesContext] - Optional Hero mode continuity context from previous nights.
 * @param {string} [params.childWish] - Optional free-text wish the child said aloud tonight (Random mode).
 * @param {string} [params.appearance] - Optional free-text visual description of the child (used for prose only).
 * @param {string} [params.dayBeats] - Today mode: 2–3 real things that happened in the child's day.
 * @param {string} [params.dayMood] - Today mode: optional mood tag (joyful, brave, nervous, tired, exciting, quiet, mixed).
 */
export function buildStoryPrompt({ name, age, interests, length, dialect, customIdea, seriesContext, childWish, appearance, dayBeats, dayMood }) {
  const ageNum = parseInt(age) || 5;
  const wordRange = getWordRange(length);
  const languageLevel = getLanguageLevel(ageNum);
  const languageStyle = getDialectInstruction(dialect);

  // Hero ideas take absolute priority. For quick stories, tonight's wish should
  // drive setting/theme inference before the child's broader saved interests.
  const inferSource = customIdea || childWish || interests;
  const setting = inferSetting(inferSource);
  const theme = inferTheme(inferSource);

  // Mode inference: today > hero > random
  // - today: parent shares real-life beats → gentle reflection story
  // - hero: custom idea is a contract, must be followed exactly
  // - random: magical story inspired by the child's interests
  const mode = dayBeats ? "today" : customIdea ? "hero" : "random";

  // Mood guidance map — shapes the emotional arc for today-mode stories
  const moodGuidance = {
    joyful: "The story should carry the warmth and happiness of today forward into a gentle celebration, ending in restful contentment.",
    brave: "Honour the child's courage today — gently reflect back how brave they were, so they fall asleep feeling strong and proud.",
    nervous: "Today had worry or nerves. The story should softly acknowledge the feeling (without naming it directly) and lead the child to a place of safety, reassurance, and peace.",
    tired: "Today was tiring or grumpy. The story should be especially slow, soft, and forgiving — a warm blanket of a story that lets the child rest.",
    exciting: "Today was full and busy. The story should slow the pace down gently, helping the child settle from a big day into quiet calm.",
    quiet: "Today was peaceful. Match that quietness with a softly paced, gentle story that honours the calm.",
    mixed: "Today held mixed feelings. Weave the moments together with warmth, ending in reassurance that every kind of day can end with a safe, loved sleep.",
  };

  // Build the idea section — fundamentally different between modes
  let ideaSection;
  if (dayBeats) {
    // TODAY MODE: Weave real-life moments into a gentle bedtime reflection
    const moodLine = dayMood && moodGuidance[dayMood]
      ? `\n\nOVERALL MOOD: ${moodGuidance[dayMood]}`
      : "";
    ideaSection = `STORY FROM TODAY (REAL LIFE → GENTLE REFLECTION):
Today, these things happened in ${name}'s real life:
"${dayBeats}"${moodLine}

YOUR TASK:
- Take ${name}'s real-day moments and reflect them back as a GENTLE bedtime story — honouring what actually happened.
- The story can be lightly imaginative (a small touch of magic, a kind animal friend, a cosy corner of nature) but it must stay CLOSE to the real events. This is a memory-keeper, not a fantasy.
- Each real moment should appear in the story as a warm, softened echo. Keep names and details the parent shared (siblings, places, small actions).
- Turn any hard moments (falls, worries, tiredness, grumpiness) into moments of BRAVERY, KINDNESS, or QUIET COURAGE. Never dwell on the difficulty — honour it, then gently move past it.
- Never invent frightening events, illness, loss, or conflict. Never introduce anything the parent didn't share.
- Close with ${name} tucked in, reflecting on today's small wins and feeling safe, loved, and ready to sleep.
- The child's interests (${interests}) may colour the tone but the REAL DAY is the subject.

Think of this as: "How would a loving grandparent retell today as a bedtime story?"`;
  } else if (customIdea) {
    // HERO MODE: The custom idea is a strict contract. The AI must follow it exactly.
    const continuityBlock = seriesContext
      ? `

SERIES CONTINUITY (KEEP THIS STABLE WHEN IT FITS TONIGHT'S IDEA):
${seriesContext}

Treat this as continuity guidance, not as replacement for the custom idea. Continue recurring characters, world details, and emotional threads where natural, while still making tonight feel like a fresh complete story.`
      : "";
    ideaSection = `CUSTOM STORY IDEA (MANDATORY — FOLLOW EXACTLY):
"${customIdea}"

The story MUST be built around this exact idea. Do NOT change, ignore, or loosely interpret it.
Do NOT replace it with your own concept. If the idea is specific, honour it precisely.
The idea is the foundation of the story — everything else (setting, characters, events) must serve it.
The child's interests are: ${interests}. Use these to enrich the story, but the custom idea takes priority.${continuityBlock}`;
  } else {
    // RANDOM MODE: Use the child's interests to inspire a magical story
    const wishBlock = childWish
      ? `

TONIGHT'S WISH (what the child said they want a story about):
"${childWish}"

    Honour this wish as TONIGHT'S MAIN STORY PROMISE. It must be central, obvious, and active on-page — not just hinted at.
    - If the wish is a simple action or image such as "flying", "swimming", or "rockets", that action/image must clearly happen in the story itself.
    - The wish should shape the beginning, the journey, and the resolution.
    - Do not replace the wish with a nearby theme. For example, "flying" should not become merely "space" or "birds"; the child should actually be flying, gliding, soaring, or lifted through the air in a calm bedtime-safe way.
    - Do not reduce the wish to a passing mention, background detail, or metaphor.
    - If the wish combines multiple parts, preserve ALL major parts together. For example:
      - "flying over dolphins" should include both the flying action and dolphins below in a sea or ocean setting.
      - "through Egypt" should clearly evoke Egypt itself — such as moonlit desert sand, pyramids, or the Nile — rather than drifting into a generic travel story.
      - "flying through Egypt" should preserve both the flying action and the Egyptian setting.

    If the wish contains anything physically impossible or over-stimulating (e.g. "flying with dolphins", "riding a rocket"), GENTLY reinterpret it into a bedtime-calm, physically plausible version:
- "flying with dolphins" → the child glides above the waves while dolphins leap joyfully beneath
- "riding a rocket" → a soft, slow moon-lantern carrying them gently to the stars
- Anything scary, fast, loud, or frightening → reshape into something calm, slow, and warm
Keep the child's imagination honoured, but always calming, never exciting or energising.`
      : "";
    ideaSection = `CHILD'S INTERESTS: ${interests}${wishBlock}

Create a magical, original story inspired by these interests${childWish ? " and tonight's wish above" : ""}. The story should feel fresh and surprising — not a generic template.`;
  }

  // Appearance block — used for prose description only, NEVER to copy character/plot
  const appearanceBlock = appearance
    ? `
- Appearance: ${appearance}

APPEARANCE RULES:
- Weave the child's appearance naturally into the prose (1–2 gentle mentions is plenty).
- If the parent referenced a known character (e.g. "hair like Princess Jasmine"), use it ONLY as a visual cue — do NOT name the character, copy their story, or borrow their setting.
- Never describe clothing, body, or features in a way that could feel uncomfortable — keep it warm, simple, and child-appropriate.`
    : "";

  return `Write a bedtime story for this child:

STORY MODE: ${mode}

CHILD:
- Name: ${name}
- Age: ${ageNum} years old${appearanceBlock}

${ideaSection}

LANGUAGE LEVEL: ${languageLevel}
LANGUAGE STYLE: ${languageStyle}

SETTING: ${setting}
THEME: ${theme}

STORY STRUCTURE:
${dayBeats
  ? `1. Opening — Begin with ${name} at the close of their day, in a warm and familiar setting (home, bedroom, garden).
2. Reflection — Gently revisit each moment from today, one by one, turning each into a soft image or small scene.
3. Honouring — Give each moment its due warmth: courage recognised, joy remembered, tiredness forgiven.
4. Comfort — A quiet moment of reassurance — that today mattered, and that ${name} is loved.
5. Bedtime — ${name} is tucked in, feeling safe and loved, drifting off. End with ${name} fully settled. You MAY add ONE final "sleepy seed" sentence — a gentle image of the story world continuing peacefully without them. No cliffhangers, no "just the beginning", no teasing.`
  : `1. Opening — Gently introduce ${name} in the setting. Establish warmth and calm.
2. Discovery — ${name} notices something curious that sparks a gentle adventure.
3. Journey — A calm, curiosity-driven journey${customIdea ? ` centred on "${customIdea}"` : ` inspired by the child's interests`}.
4. Resolution — A warm, satisfying moment of wonder or kindness.
5. Bedtime — ${name} returns home feeling safe, happy, and ready to sleep. End with ${name} fully settled. You MAY add ONE final "sleepy seed" sentence — a gentle image of the story world continuing peacefully without them (e.g. the characters tucking themselves in, the setting growing quiet). No cliffhangers, no "just the beginning", no teasing. The sleepy seed is warm and permanent, not exciting.`}

LENGTH: ${wordRange}
${CONTEXT_LOCK}

Write the story now.`;
}

/**
 * Build the user-facing prompt for the editor pass.
 */
export function buildGrammarPrompt(storyText, dialect) {
  return `Review and polish this bedtime story for publication. Ensure it reads beautifully aloud and feels like a professionally published children's book.

Use ${getDialectInstruction(dialect)} consistently. Fix any mixed spelling or phrasing.

You must also verify that setting, timeline, and character behaviour are fully consistent. Fix any issues you find.

STORY:
${storyText}`;
}

/**
 * Build the user-facing prompt for the final validation pass.
 * Includes mode and context so the validator can perform mode-specific checks.
 *
 * @param {string} storyText - The story to validate
 * @param {Object} context
 * @param {string} context.mode - "random" or "hero"
 * @param {string} [context.dialect] - "en-GB"/"en-US" or legacy "british"/"american" spelling and phrasing preference.
 * @param {string} [context.interests] - Child's interests (for random mode check)
 * @param {string} [context.customIdea] - The exact story idea (for hero mode integrity check)
 * @param {string} [context.childWish] - The exact quick-story wish to preserve in random mode.
 * @param {string} [context.seriesContext] - Prior series continuity guidance for Hero mode.
 */
export function buildValidationPrompt(storyText, { mode, dialect, interests, customIdea, childWish, seriesContext, dayBeats } = {}) {
  let modeContext = "";

  if (mode === "today" && dayBeats) {
    modeContext = `\nSTORY MODE: today
REAL-LIFE DAY MOMENTS the parent shared: "${dayBeats}"

Perform the DAY-BEAT FIDELITY CHECK: verify each shared moment appears as a warm, softened echo. No invented frightening events, illness, conflict, or unshared details. Hard moments must be reframed with warmth, not dwelt on. If fidelity is broken — rewrite surgically.`;
  } else if (mode === "hero" && customIdea) {
    modeContext = `\nSTORY MODE: hero
CUSTOM IDEA (the story MUST centre around this): "${customIdea}"
CHILD'S INTERESTS: ${interests || "not specified"}
${seriesContext ? `SERIES CONTINUITY TO PRESERVE WHEN RELEVANT: "${seriesContext}"\n
Perform the CONTINUITY CHECK: keep recurring world logic, companion identity, and emotional thread aligned with the prior series context unless the new custom idea clearly changes part of that path.\n
` : ""}Perform the IDEA INTEGRITY CHECK: verify the custom idea is central, present, and actively used throughout the story. If the idea is missing, diluted, or replaced — rewrite to align with it.`;
  } else if (mode === "random" && interests) {
    modeContext = `\nSTORY MODE: random
CHILD'S INTERESTS: ${interests}

${childWish ? `TONIGHT'S WISH: "${childWish}"\n` : ""}

Perform the INTEREST UTILISATION CHECK: verify at least one interest plays a meaningful role in the story — not just a brief mention. If interests are ignored, weave them in.
${childWish ? `Perform the WISH FIDELITY CHECK: verify tonight's wish remains central and recognisable in the story. If the wish is a simple action or image such as "flying" or "swimming", that action/image must clearly happen on-page rather than being replaced by a nearby generic theme. If the wish combines multiple major parts, preserve all of them together so the story does not drop the creature, place, or action that made the wish specific. If the wish has drifted into something generic or unrelated — rewrite surgically to restore it.` : ""}`;
  }

  return `Perform a strict final validation on this bedtime story. Check setting consistency, timeline logic, character consistency, grammar, child safety, and dialect consistency.
Use ${getDialectInstruction(dialect)} consistently throughout. If any spelling or phrasing mixes dialects, correct it.
${modeContext}
If perfect, return it exactly as-is. If any issue exists, fix it silently.

STORY:
${storyText}`;
}

/**
 * Build a prompt to generate a short, magical story title.
 */
export function buildTitlePrompt(storyText, childName, dialect) {
  return `Generate a short, enchanting title (3–6 words) for this children's bedtime story. The main character is called ${childName}.
Use ${getDialectInstruction(dialect)} if spelling choices matter.

Return ONLY the title — no quotes, no punctuation, no explanation.

STORY (excerpt):
${storyText.substring(0, 600)}`;
}

/**
 * Build a prompt for the final delivery-quality cleanup pass.
 */
export function buildDeliveryQaPrompt(storyText, { issues = [], dialect } = {}) {
  const issueBlock = issues.length
    ? issues.map((issue) => `- ${issue}`).join("\n")
    : "- General final quality cleanup only."
;

  return `Perform a final delivery-quality cleanup on this bedtime story.
Use ${getDialectInstruction(dialect)} consistently.

Focus on these issues:
${issueBlock}

Make the smallest possible corrections, then return ONLY the final story text.

STORY:
${storyText}`;
}

// =============================================================================
// Helpers — Language, Setting, and Theme inference
// =============================================================================

function getWordRange(length) {
  switch (length) {
    case "short": return "250–350 words";
    case "long": return "1000–1300 words, paced like an unhurried 9–10 minute bedtime read-aloud";
    default: return "450–650 words";
  }
}

function getDialectInstruction(dialect) {
  const normalized = String(dialect || "").trim().toLowerCase();
  return normalized === "american" || normalized === "en-us"
    ? "American English (en-US) spelling and phrasing (for example: color, favorite, cozy, mom, traveling, prioritize)"
    : "British English (en-GB) spelling and phrasing (for example: colour, favourite, cosy, mum, travelling, prioritise)";
}

/**
 * Returns language guidance calibrated to the child's age.
 */
function getLanguageLevel(age) {
  if (age <= 3) {
    return "Very simple words, very short sentences (5–8 words). Gentle repetition is encouraged. Board book level.";
  }
  if (age <= 5) {
    return "Simple vocabulary, short sentences (8–12 words). Gentle repetition and rhythm. Picture book level.";
  }
  if (age <= 7) {
    return "Clear vocabulary with some descriptive words. Sentences of 10–15 words. Light dialogue is fine.";
  }
  if (age <= 9) {
    return "Rich but accessible vocabulary. Varied sentence lengths. Dialogue and description balanced. Early reader level.";
  }
  return "Confident vocabulary with vivid descriptions. Complex sentences allowed. Engaging narrative voice. Middle-grade level.";
}

/**
 * Infer a setting from the child's interests.
 * Falls back to a gentle, universal setting.
 */
function inferSetting(interests) {
  const lower = (interests || "").toLowerCase();
  const map = [
    [/dinosaur|dino|t[\s-]?rex/, "a gentle prehistoric valley with warm ferns and a glowing amber sky"],
    [/princess|castle|queen|king|prince/, "a peaceful moonlit castle with enchanted gardens"],
    [/ocean|sea|fish|mermaid|whale|dolphin|swim|swimming|underwater/, "a tranquil ocean cove glowing with soft light"],
    [/egypt|egyptian|pyramid|pyramids|pharaoh|nile|desert/, "a calm golden desert where moonlit pyramids and the quiet Nile shimmer softly"],
    [/space|rocket|planet|star|astronaut|moon|fly|flying|glide|gliding|soar|soaring/, "a calm, twinkling corner of the galaxy"],
    [/dragon/, "a cosy mountain hollow where friendly dragons nest"],
    [/robot|machine|android/, "a gentle workshop town where kind robots live"],
    [/farm|horse|cow|pig|chicken|sheep/, "a peaceful countryside farm bathed in golden light"],
    [/jungle|monkey|tiger|lion|elephant/, "a warm jungle clearing dappled with moonlight"],
    [/pirate|ship|treasure|sail/, "a calm tropical island under a blanket of stars"],
    [/car|truck|train|vehicle/, "a sleepy little town with winding roads under the stars"],
    [/fairy|magic|wizard|witch|spell/, "an enchanted forest glade sparkling with gentle magic"],
    [/superhero|hero|power|cape/, "a quiet neighbourhood bathed in warm evening light"],
    [/bear|bunny|rabbit|fox|deer|owl/, "a peaceful woodland at twilight, softly lit by fireflies"],
    [/unicorn|rainbow|pony/, "a meadow of soft colours beneath a shimmering rainbow"],
    [/football|soccer|sport|basketball/, "a friendly village with a moonlit playing field nearby"],
  ];

  for (const [pattern, setting] of map) {
    if (pattern.test(lower)) return setting;
  }

  return "a calm, enchanted place where gentle adventures begin";
}

/**
 * Infer a theme from the child's interests.
 * Falls back to a universal bedtime-friendly theme.
 */
function inferTheme(interests) {
  const lower = (interests || "").toLowerCase();
  const map = [
    [/friend/, "the warmth of friendship and being there for each other"],
    [/brave|hero|superhero|courage/, "quiet courage and believing in yourself"],
    [/animal|pet|bear|bunny|fox/, "kindness to all creatures and the bonds between friends"],
    [/magic|fairy|wizard|spell/, "wonder, discovery, and the magic in everyday moments"],
    [/egypt|egyptian|pyramid|pyramids|pharaoh|nile|desert|explore|adventure|discover|quest|fly|flying|swim|swimming|glide|gliding/, "curiosity, discovery, and the joy of exploring"],
    [/help|kind|care|share/, "the gentle power of kindness and helping others"],
    [/family|home|mum|dad|sister|brother/, "the comfort of family and the warmth of home"],
  ];

  for (const [pattern, theme] of map) {
    if (pattern.test(lower)) return theme;
  }

  return "kindness, courage, and the comfort of home";
}
