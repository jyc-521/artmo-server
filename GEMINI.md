@AGENTS.md

## Gemini CLI
- `.claude/rules/*.md`는 자동으로 적용되지 않는다. 해당 경로의 파일을 고치기 전에 그 규칙 파일을 직접 읽는다: `src/routes/`·`src/middleware/`·`supabase/` → `auth-and-sql.md`, `src/services/ai.service.ts`·`src/config/gemini.ts`·`scripts/collect-artworks.ts` → `ai-boundary.md`.
- 스킬은 `.agents/skills/`를 사용한다.
- 비밀 파일 차단은 `.geminiignore`가 담당한다.
