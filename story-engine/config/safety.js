/**
 * Safety Configuration
 * Content moderation, bedtime suitability, and child safety rules
 */

export const SAFETY_CONFIG = {
  // Age-appropriate content rules
  ageGroups: {
    toddler: {
      ageRange: [2, 4],
      rules: [
        "Simple language only",
        "No complex emotions",
        "Very short sentences",
        "Repetitive, soothing patterns",
        "Familiar scenarios only"
      ]
    },
    preschool: {
      ageRange: [5, 6],
      rules: [
        "Age-appropriate vocabulary",
        "Basic problem-solving",
        "Predictable endings",
        "Familiar characters",
        "Simple moral lessons"
      ]
    },
    earlyElementary: {
      ageRange: [7, 9],
      rules: [
        "Richer vocabulary",
        "Character development",
        "Mild challenges",
        "Some surprises",
        "Subtle emotional learning"
      ]
    },
    late_elementary: {
      ageRange: [10, 12],
      rules: [
        "Complex vocabulary",
        "Character arcs",
        "Real-world themes",
        "Meaningful challenges",
        "Growth and transformation"
      ]
    }
  },

  // Content restrictions
  forbiddenContent: [
    "violence or harm",
    "scary or disturbing imagery",
    "death or injury to characters",
    "abandonment or separation trauma",
    "parental absence or loss",
    "sexual or inappropriate content",
    "discrimination or prejudice",
    "drug or alcohol references",
    "heavy emotional distress without resolution"
  ],

  // Bedtime-specific safety
  bedtimeSafety: {
    mustHave: [
      "safe resolution",
      "sense of comfort and security",
      "calming conclusion",
      "no cliffhangers",
      "positive emotional note"
    ],
    avoid: [
      "sudden scares or surprises",
      "unresolved tension",
      "scary creatures without context",
      "loud or jarring elements",
      "overstimulation"
    ]
  },

  // Personalization safety
  personalization: {
    mustInclude: [
      "child's name",
      "child's gender (optional)",
      "child's interests"
    ],
    neverExpose: [
      "real family names",
      "school information",
      "address or location data",
      "personal details beyond story context"
    ]
  },

  // Quality gates
  qualityGates: {
    emotionalConsistency: 0.85,
    contentSuitability: 0.95,
    bedtimeSuitability: 0.90,
    prose quality: 0.80
  }
};

export default SAFETY_CONFIG;
