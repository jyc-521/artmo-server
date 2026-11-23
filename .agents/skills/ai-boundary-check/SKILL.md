---
name: ai-boundary-check
description: >
  Verify the ARTMO Gemini recommendation boundary: user sentences passed as data,
  JSON schema output, candidate-only artwork selection, fallbacks, and
  prompt-injection test cases. Use when editing src/services/ai.service.ts,
  src/services/recommendations.service.ts, src/config/gemini.ts, or
  scripts/collect-artworks.ts. Do not use for auth routes, SQL schema, or client UI work.
compatibility: Requires Node.js 24+ and npm
---

# AI Boundary Check

1. Read `.claude/rules/ai-boundary.md` and compare the change against it.
2. From the repository root, run `node .agents/skills/ai-boundary-check/scripts/verify-ai-boundary.mjs`. It checks source patterns only.
3. Make sure `tests/ai.service.test.ts` covers every case in `references/injection-cases.md` with a mocked Gemini response. Then run `npm exec --no -- jest tests/ai.service.test.ts`.
4. Never call the real Gemini API during this check. Report which checks ran and their results.
