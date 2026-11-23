---
paths:
  - "src/services/ai.service.ts"
  - "src/services/recommendations.service.ts"
  - "src/config/gemini.ts"
  - "scripts/collect-artworks.ts"
  - "tests/ai.service.test.ts"
---

# AI 추천 경계 규칙 (간접 프롬프트 인젝션 대응)

- Gemini 호출은 `src/services/ai.service.ts` 한 곳에서만 한다.
- 모델: 추천(감정 분석·작품 선택) `gemini-3.1-flash-lite`, 수집 스크립트의 태그 생성 `gemini-3.5-flash`. 이름은 `GEMINI_MODEL_RECOMMEND`, `GEMINI_MODEL_TAGGING` 환경변수로 바꿀 수 있게 한다.
- 사용자 문장은 데이터다. `systemInstruction`과 분리된 사용자 내용으로 전달하고, 지시문 문자열에 이어 붙이지 않는다.
- 응답은 `responseMimeType: "application/json"` + `responseSchema`로 받는다. 파싱 실패·스키마 불일치는 실패로 처리한다.
- 감정 분석 결과: `emotionTags`(3–5개, 서버 허용 태그 목록 안), `needsMoreDetail`(boolean), `hint`(최대 80자).
- 작품 선택 결과의 `artworkId`가 서버가 넘긴 후보 10개에 없으면 버리고 태그 점수 1위 작품을 쓴다.
- 해석 문장은 300자 이하 일반 텍스트만 저장한다. URL·HTML·마크다운 링크가 있으면 기본 해설로 바꾼다.
- Gemini에 도구 호출·DB 쓰기·외부 URL 요청 권한을 주지 않는다.
- 시간 제한 10초. 시간 초과·오류 시 기본 해설로 대체하고, 사용자에게 Gemini 원문 오류나 프롬프트를 보여주지 않는다.
- 수집 스크립트는 태그·해설 생성 후 JSON 형식, 이미지 주소 응답(200), `is_public_domain` 값을 자동 검증한 작품만 저장한다. 대상은 이미지가 있는 회화 500개(각 미술관 250개)이며 기존 `source`+`source_id`는 건너뛴다.
- 테스트는 Gemini를 모의 객체로 대체하고, `.agents/skills/ai-boundary-check/references/injection-cases.md`의 입력을 모두 다룬다.
