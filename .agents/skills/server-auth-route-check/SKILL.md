---
name: server-auth-route-check
description: >
  Verify ARTMO Express route guards (optionalAuth, isAuthenticated, requireAdmin),
  the 401/403 role matrix, daily recommendation limits, CORS, and Jest API tests.
  Use when editing src/routes/, src/middleware/, src/controllers/, or src/app.ts.
  Do not use for docs-only edits, CSS, or SQL seed data changes.
compatibility: Requires Node.js 24+ and npm
---

# Server Auth & Route Guard Check

1. Compare changed endpoints against `references/role-matrix.md`. Keep `isAuthenticated` before `requireAdmin` and take the acting user only from `req.auth`.
2. From the repository root, run `node .agents/skills/server-auth-route-check/scripts/verify-route-guards.mjs`. It checks source patterns only; request behavior is verified by Jest.
3. Run `npm run typecheck` and `npm exec --no -- jest --runInBand tests/api.test.ts`. Add anonymous, user and admin cases for any new endpoint.
4. Report which checks ran and their results. Run live Supabase scripts only when the user asks.
