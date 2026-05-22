// =============================================================================
// Shared utilities — imported by app.js and story-engine.js
// =============================================================================

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function formatName(name) {
  if (!name) return "A little one";
  const trimmed = name.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
