# DreamTalez Story Engine

**PHASE 1: Building the Architecture (Current)**

A dedicated narrative orchestration engine for generating personalized, emotionally resonant bedtime stories.

## Architecture Overview

```
story-engine/
├── core/              # Engine lifecycle & orchestration
├── config/            # Model, generation, safety configuration
├── frameworks/        # Narrative intelligence rules & design
├── orchestration/     # LLM orchestration & context management
├── runtime/           # Story generation & refinement pipeline
├── validation/        # Multi-layer story validation
├── memory/            # Emotional & sensory memory systems
├── quality-control/   # Scoring & quality gates
├── analytics/         # Performance & engagement tracking
├── output/            # Generated stories & blueprints
└── tests/             # Test suite
```

## Design Principles

- **Framework-Driven**: Narrative rules guide generation, not direct prompting
- **Orchestrated**: Opus designs frameworks, Sonnet executes runtime
- **Modular**: Each subsystem is independently testable
- **Safe**: No breaking changes to production; built in parallel
- **Scalable**: Context management & refinement layers for consistency

## Current Phase

### PHASE 1: Architecture Foundation (IN PROGRESS)
- [ ] Directory structure created
- [ ] Core orchestration files
- [ ] Framework definitions
- [ ] Schema definitions
- [ ] Validation stubs

### PHASE 2: Validation (PENDING)
- Validate generation pipeline
- Validate orchestration
- Validate refinement
- Validate runtime context handling

### PHASE 3: Integration (PENDING)
- Connect to existing `/api/generate` endpoint
- Maintain backward compatibility
- Test with live story requests

### PHASE 4: Deprecation (PENDING)
- Gradually replace old logic
- Sunset legacy prompts.js
- Monitor production metrics

## Important: No Breaking Changes

- Current `server.js` remains operational
- Existing `prompts.js`, `story-quality.js` untouched
- Story engine runs **in parallel** until validated
- No immediate refactoring of production code

## Next Steps

1. Create core orchestration files (context-orchestrator, pipeline-controller)
2. Build framework definitions (narrative, character, scene, refinement)
3. Build validation layer
4. Create runtime generators with framework injection
5. Write Phase 2 validation tests
