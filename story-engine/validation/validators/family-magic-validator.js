/**
 * Family Magic Validator
 *
 * Validates Family Magic stories: child-as-hero enforcement,
 * comfort item presence, family member role balance, and
 * personalisation density.
 *
 * Only runs when familyMagic is enabled.
 * Score: 1–10.
 */

const MIN_CHILD_NAME_MENTIONS  = 3;
const MIN_COMFORT_ITEM_HITS    = 1;
const MAX_FAMILY_SOLVE_SIGNALS = 2; // family must not dominate/solve the adventure

const FAMILY_SOLVE_SIGNALS = [
  "dad solved", "mum solved", "mom solved", "daddy fixed", "mummy fixed",
  "grandma saved", "grandpa saved", "dad rescued", "mum rescued",
  "her dad", "his mum", "her mom", "his dad",
  "dad came and", "mum came and", "mom came and",
];

const CHILD_HERO_SIGNALS = [
  "decided", "discovered", "figured out", "found", "realised", "realized",
  "knew", "chose", "led", "climbed", "stepped forward", "reached out",
  "tried", "solved", "helped", "called out", "said", "noticed",
];

export class FamilyMagicValidator {
  /**
   * @param {string} text - Full story text
   * @param {{ childName?: string, comfortItems?: string[], familyMembers?: string[] }} opts
   * @returns {{ section: string, score: number, warnings: string[] }}
   */
  validate(text = "", opts = {}) {
    const { childName, comfortItems = [], familyMembers = [] } = opts;
    let score = 10;
    const warnings = [];
    const lower = text.toLowerCase();

    // Child name presence — personalisation density
    if (childName) {
      const namePattern = new RegExp(`\\b${childName.toLowerCase()}\\b`, "g");
      const nameCount = (lower.match(namePattern) || []).length;
      if (nameCount < MIN_CHILD_NAME_MENTIONS) {
        score -= 2;
        warnings.push(`Child name "${childName}" only appears ${nameCount}× — needs ${MIN_CHILD_NAME_MENTIONS}+ for personalisation depth`);
      }
    }

    // Comfort item integration
    if (comfortItems.length > 0) {
      const foundItems = comfortItems.filter((item) =>
        lower.includes(item.toLowerCase())
      );
      if (foundItems.length < MIN_COMFORT_ITEM_HITS) {
        score -= 2;
        warnings.push(`Comfort item(s) not found in story — "${comfortItems[0]}" should appear as a grounding anchor`);
      }
    }

    // Child-as-hero — must take meaningful action
    const heroActionCount = CHILD_HERO_SIGNALS.filter((s) => lower.includes(s)).length;
    if (heroActionCount < 2) {
      score -= 2;
      warnings.push(`Child-as-hero weak — only ${heroActionCount} active-agency signals (decided/discovered/figured out etc.)`);
    }

    // Family member role check — must not dominate or solve
    let familySolveCount = FAMILY_SOLVE_SIGNALS.filter((s) => lower.includes(s)).length;

    // Also check custom family member names for solve patterns
    for (const member of familyMembers) {
      const memberLower = member.toLowerCase();
      const solvePattern = new RegExp(`${memberLower} (solved|fixed|saved|rescued|came and)`, "g");
      const matches = lower.match(solvePattern);
      if (matches) familySolveCount += matches.length;
    }

    if (familySolveCount > MAX_FAMILY_SOLVE_SIGNALS) {
      score -= 2;
      warnings.push(`Family members solving/dominating detected (${familySolveCount} signals) — child must remain the hero`);
    }

    // Family member presence — they should appear but support, not lead
    if (familyMembers.length > 0) {
      const familyFound = familyMembers.filter((m) => lower.includes(m.toLowerCase()));
      if (familyFound.length === 0) {
        score -= 1;
        warnings.push("Family members not found in story — Family Magic requires their warm presence");
      }
    }

    return {
      section:  "family-magic",
      score:    Math.max(score, 1),
      warnings,
    };
  }
}

export default FamilyMagicValidator;
