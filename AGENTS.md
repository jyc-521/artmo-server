# ARTMO Server Guidelines

ARTMO(Art + Emotion)의 Express API 서버. 사용자의 기분 문장 → 퍼블릭 도메인 명화 1점 + 해석. 기능 범위·화면·권한표·데이터 모델은 `docs/PRD.md`가 기준이며, 이 파일에 PRD 내용을 복사하지 않는다.

## Map & Checks (npm only · Node 24.x)
- Stack: Express 5, TypeScript 5.9 (`commonjs`, `module: "Node16"`), `@supabase/supabase-js` 2.x, `@google/genai`. 배포 Render. 클라이언트는 별도 저장소 `artmo-client`(Vercel).
- `server.ts` → `src/app.ts`의 `createApp()`: CORS, `express.json({ limit: "100kb" })`, `/health`, 라우터, 마지막에 `notFound` → `errorHandler`.
- Code: `src/routes/`(`auth`, `users`, `artworks`, `recommendations`, `sponsorships`), `src/middleware/`, `src/controllers/`, `src/services/`, `src/config/`.
- DB: `supabase/schema.sql`(여러 번 실행해도 같은 결과인 스키마·트리거·RPC·RLS), `supabase/seed.sql`.
- 작품 수집: `scripts/collect-artworks.ts`.
- Tests: `tests/`(Jest + Supertest API, PGlite SQL). 테스트에서 Gemini는 항상 모의 객체.
- Verify:
  - TypeScript 변경: `npm run typecheck` + 관련 Jest 파일
  - 라우트·권한 변경: `npm exec --no -- jest --runInBand tests/api.test.ts`
  - 스키마·시드 변경: `npm run test:sql`
  - 전체: `npm test` · 빌드 설정 변경: `npm run build`
- 실제 Supabase·Gemini·미술관 API를 부르는 스크립트(`collect:artworks`, `db:check`, `test:live`)는 사용자가 요청하고 `.env`가 준비된 경우에만 실행.

## Core Invariants
- 인증: Bearer JWT는 `db.auth.getUser(token)`으로 검증 후 활성 `public.profiles` 행 확인. 요청자 ID·역할은 `req.auth`에서만 가져오고 본문·쿼리 값은 신뢰하지 않는다.
- 순서: `isAuthenticated` → `requireAdmin`. `optionalAuth`는 `POST /api/recommendations`, `GET /api/recommendations/:id`에만. 토큰 없음·무효 `401`, 비활성·관리자 아님 `403`, Auth 장애 `503`.
- 권한표: 모든 엔드포인트는 PRD 5-3을 따른다. 새 엔드포인트는 `tests/api.test.ts`에 비로그인·일반 사용자·관리자 세 경우를 추가.
- 소유권: `/me` 경로와 저장 목록은 `req.auth.userId`로만 필터링. 타인 기록 요청은 `403`.
- 추천 횟수: 하루 비로그인 IP당 3회, 로그인 사용자당 10회, 한국 시간 자정 초기화. 초과 `429`.
- 입력: 기분 문장은 앞뒤 공백 제거 후 5–200자. 협찬 신청은 `license_agreed === true` 필수, `goods_consent` 기본 `false`. 실패 `400`.
- AI 경계: `.claude/rules/ai-boundary.md`(AI 관련 파일 작업 시 자동 적용). Gemini는 서버가 넘긴 후보 ID 중에서만 고른다.
- DB: 5개 테이블 모두 RLS, 권한은 `service_role`에만, 함수에 `set search_path=''`, 새 프로필은 `user_type = 'user'`. 협찬 승인은 한 트랜잭션의 멱등 RPC. 마지막 관리자 변경·탈퇴는 `409`(`LAST_ADMIN`).
- 응답: 작품·추천·협찬 `{ data }`, 사용자·프로필 `{ success: true, data }`, 삭제 `204`, 오류 `{ success: false, message, error: { message } }`, 없는 경로 `404 { error: { message } }`.
- CORS: 쉼표로 구분한 `CLIENT_URL` 허용 목록, 와일드카드 금지, `credentials: false`, 헤더 `Content-Type`·`Authorization`.

## Secrets
- `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY`, `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`은 서버 전용. 응답·로그·테스트·클라이언트 환경 파일에 넣지 않는다.
- 기분 문장·비밀번호·토큰 원문은 로그에 남기지 않는다.
- `.env`, `.env.*`(`.env.example` 제외), `*.pem`, `*.key`는 읽지도, 출력하지도, 복사하지도 않는다. 변수 이름은 `.env.example`에서 확인하고, 실제 키가 필요한 명령은 사용자에게 실행을 요청한다. 실수로 키 값을 봤다면 바로 사용자에게 알리고 키 재발급을 권한다.
- 위 규칙은 도구 설정으로도 강제한다: `.claude/settings.json`(권한 + PreToolUse 훅), `.geminiignore`. `.gitignore`에 `.env*`(`.env.example` 제외)를 유지한다.

## Detailed References (필요할 때만 읽기)
- 제품 명세·화면·권한표·데이터 모델: `docs/PRD.md`
- 인증·SQL 세부 규칙: `.claude/rules/auth-and-sql.md`
- AI 추천 세부 규칙: `.claude/rules/ai-boundary.md`
- 스킬 (해당 작업을 마치기 전에 실행):
  - `src/routes/`·`src/middleware/`·`src/controllers/`·`src/app.ts` 수정 → `server-auth-route-check`
  - Gemini 호출·추천 로직·수집 스크립트 수정 → `ai-boundary-check`
