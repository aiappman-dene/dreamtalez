/**
 * Story Engine Integration Guide
 * 
 * How to connect the story-engine/ to the existing server.js
 * PHASE 3: Integration steps
 */

# Story Engine Integration Plan

## Current State (PHASE 1)
- ✅ story-engine/ directory structure created
- ✅ Core orchestration classes defined
- ✅ Framework files scaffolded
- ✅ Validation engine structure defined
- ✅ Configuration files created

## PHASE 2: Validation
- [ ] Implement scene-generator.js
- [ ] Implement prose-refinement.js
- [ ] Implement sensory-injector.js
- [ ] Implement bedtime-controller.js
- [ ] Implement all validators
- [ ] Write unit tests for each component
- [ ] Test pipeline end-to-end with mock data

## PHASE 3: Integration with server.js

### Step 1: Create adapter layer

```javascript
// story-engine/adapters/server-adapter.js
export class ServerAdapter {
  constructor(storyEngine) {
    this.engine = storyEngine;
  }

  // Convert Express request to engine format
  async handleGenerateRequest(req) {
    const storyRequest = {
      childName: req.body.childName,
      childAge: req.body.childAge,
      childGender: req.body.childGender,
      theme: req.body.theme,
      length: req.body.length
    };

    return await this.engine.generateStory(storyRequest);
  }
}
```

### Step 2: Update server.js

```javascript
// server.js (PHASE 3)
import StoryEngine from "./story-engine/core/app.js";

const engine = new StoryEngine(config);
await engine.initialize();

// Existing /api/generate endpoint now uses story-engine
app.post("/api/generate", async (req, res) => {
  const result = await engine.generateStory({
    childName: req.body.childName,
    // ... other params
  });

  res.json(result);
});
```

### Step 3: Backward compatibility

- Existing `prompts.js` remains untouched
- Old logic continues to work
- Story-engine runs in parallel
- Gradual migration of endpoints

### Step 4: Monitoring

- Log all story-engine generations
- Compare quality with existing system
- Monitor performance metrics
- Collect failure data

## PHASE 4: Deprecation

Only after PHASE 3 validation:
- Replace old prompts.js logic
- Sunset legacy story-quality.js
- Archive old generation code

## Safety Checkpoints

Each phase must verify:
- ✅ No breaking changes to server.js
- ✅ Stripe functionality unaffected
- ✅ Authentication unaffected
- ✅ Current deployments still work
- ✅ Story quality maintained or improved

---

## Timeline

- **PHASE 1**: 1-2 days (architecture, framework definitions)
- **PHASE 2**: 3-5 days (implement pipeline, validate)
- **PHASE 3**: 2-3 days (integrate, test, monitor)
- **PHASE 4**: 1 week (gradual deprecation)

**Total**: ~2 weeks for complete migration
