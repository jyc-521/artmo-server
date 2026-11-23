---
paths:
  - "src/app.ts"
  - "src/routes/**"
  - "src/middleware/**"
  - "src/controllers/**"
  - "src/services/**"
  - "src/config/supabase.ts"
  - "supabase/**"
---

# 인증·라우트 권한·SQL 규칙

- 관리자 엔드포인트(`users` 관리, `artworks` 쓰기, `sponsorships` 심사)는 항상 `isAuthenticated` 다음에 `requireAdmin`.
- `optionalAuth`는 토큰이 있으면 `isAuthenticated`와 같은 검증을 하고, 토큰이 없을 때만 통과시킨다. 무효 토큰을 비로그인으로 취급하지 않는다(`401`).
- 요청자 ID·역할은 `req.auth`에서만. 라우트 파라미터의 `userId`, 본문의 `userType`은 관리자 작업의 입력값으로만 검증한다.
- `src/config/supabase.ts`는 `persistSession: false`, `autoRefreshToken: false`, `detectSessionInUrl: false`를 유지하고 `throwDatabaseError`의 RPC 오류 매핑(`LAST_ADMIN` → `409`, 제약 위반 `23514` → `400`)을 보존한다.
- 스키마 함수마다 `set search_path=''`. `PUBLIC`·`anon`·`authenticated`의 실행 권한을 회수하고, 호출하는 RPC만 `service_role`에 `EXECUTE`. 트리거 전용 함수에는 부여하지 않는다.
- RLS: `profiles`, `artworks`, `recommendations`, `saves`, `sponsorships` 모두 활성. 커밋 전 `notify pgrst, 'reload schema'`.
- `approve_artmo_sponsorship`은 `for update`로 신청 행을 잠그고, `artworks.source_sponsorship_id` 유일 제약으로 두 번 승인해도 작품이 1개만 생기게 한다.
- `artworks`에는 `is_public_domain = true`이거나 승인된 협찬 작품만 저장한다.
- 인증 비밀번호·해시·토큰을 `public.*` 테이블에 복사하지 않는다.
