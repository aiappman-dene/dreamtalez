/**
 * Cozy Callback Engine
 *
 * Converts comfort items from a FamilyMagicMemory instance into
 * natural-language instructions for the story renderer.
 * Each callback tells Claude *when* and *how* to surface a comfort item —
 * not that it must mention it by name every time.
 */

export function buildCozyCallbacks({ runtimeContext, continuityMemory }) {
  const callbacks = [];

  const items = runtimeContext.familyMagic?.comfortItems
    || continuityMemory?.getContinuityContext()?.recurringItems
    || [];

  items.forEach((item) => {
    callbacks.push(
      `Lightly reference "${item}" during an emotional or calming scene — once, naturally, as if it has always been there.`
    );
  });

  // Cozy patterns (favorite feeling / place) become atmospheric scene flavour
  const patterns = continuityMemory?.getContinuityContext()?.cozyPatterns || [];
  patterns.slice(0, 2).forEach((pattern) => {
    callbacks.push(
      `Weave this sensory warmth into the story world: "${pattern}".`
    );
  });

  return callbacks;
}

export default buildCozyCallbacks;
