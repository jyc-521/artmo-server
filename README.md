# ARTMO Server

기분 문장 → 퍼블릭 도메인 명화 추천 API. Express 5 · TypeScript · Supabase · Gemini.

## 처음 설정

1. **Supabase 프로젝트 만들기** → SQL Editor에서 `supabase/schema.sql` 실행 → `supabase/seed.sql` 실행(기본 작품 3점)
2. **`.env` 만들기**: `.env.example`을 복사해 `.env`로 저장하고 값을 채운다. `.env`는 GitHub에 올리지 않는다.
   - `SUPABASE_URL`, `SUPABASE_SECRET_KEY`: Supabase › Project Settings › API
   - `GEMINI_API_KEY`: Google AI Studio › Get API key
   - `CLIENT_URL`: 클라이언트 주소(로컬은 기본값 그대로)
3. 설치와 실행

```bash
npm ci
npm run db:check          # 테이블 5개와 추천 함수 확인
npm run dev               # http://localhost:3000/health → {"status":"ok"}
```

4. **작품 채우기** (Gemini 무료 등급 기준 한두 시간 걸린다)

```bash
npm run collect:artworks -- --per 5 --dry-run   # 저장 없이 5점씩 시험
npm run collect:artworks                        # 미술관별 250점, 총 500점
```

5. **첫 관리자 지정**: 사이트에서 가입한 뒤 Supabase SQL Editor에서
   `update public.profiles set user_type='admin' where email='내 이메일';`

## 검사

```bash
npm run typecheck
npm test                  # Jest(권한표·AI 경계) + PGlite(SQL)
npm run build
node .agents/skills/server-auth-route-check/scripts/verify-route-guards.mjs
node .agents/skills/ai-boundary-check/scripts/verify-ai-boundary.mjs
```

## Render 배포

- New › Web Service › 이 저장소 연결
- Build Command `npm ci --include=dev && npm run build` (NODE_ENV=production이면 TypeScript 같은 개발용 패키지가 빠지므로 `--include=dev` 필요) · Start Command `npm start`
- Environment에 `.env`의 값을 하나씩 입력 (`CLIENT_URL`은 Vercel 주소)
- 배포 후 `https://<서비스>.onrender.com/health` 확인

## API 요약

권한표 전체는 `.agents/skills/server-auth-route-check/references/role-matrix.md`.

| 경로 | 권한 |
| --- | --- |
| `POST /api/recommendations` | 공개 (비로그인 하루 3회, 로그인 10회) |
| `GET /api/recommendations/:id` · `POST /:id/share` | 공개 |
| `GET /api/recommendations/me` | 로그인 |
| `GET /api/artworks` · `/popular` · `/tags` · `/:id` | 공개 |
| `GET /api/artworks/saved` · `POST·DELETE /:id/save` | 로그인 |
| `POST·PUT·DELETE /api/artworks` | 관리자 |
| `POST /api/sponsorships` · `GET /me` | 로그인 |
| `GET /api/sponsorships` · `POST /:id/approve` · `PUT /:id` | 관리자 |
| `GET /api/auth/me` · `/api/users/profile` · `DELETE /api/users/account` | 로그인 |
| `GET /api/users/all` · `PUT /api/users/:userId/type` | 관리자 |
