// 위기 신호(죽고 싶다·자해 등)가 담긴 문장에는 그림 추천 대신 도움받을 곳을 안내한다.
// AI 판단(riskOfHarm)과 별개로 서버 키워드 검사를 함께 써서, AI가 실패·대체 흐름일 때도 놓치지 않는다.
// '배고파 죽겠다', '웃겨 죽겠다'처럼 세기를 나타내는 관용 표현은 키워드에 걸리지 않게 한다.

const RISK_PATTERNS = [
  /죽고\s*싶/, /죽어\s*버리/, /죽어\s*버려/, /나가\s*죽/, /콱\s*죽/, /확\s*죽/,
  /자살/, /자해/, /목숨을?\s*끊/, /살기\s*싫/, /살고\s*싶지\s*않/, /사라지고\s*싶/, /없어지고\s*싶/,
  /세상을\s*떠나고\s*싶/, /그만\s*살/, /손목을?\s*긋/,
];

export function hasRiskKeyword(sentence: string): boolean {
  const text = sentence.replace(/\s+/g, " ");
  return RISK_PATTERNS.some((p) => p.test(text));
}

export const SUPPORT_MESSAGE =
  "많이 힘든 마음이 느껴져요. 이런 순간에는 그림보다 사람의 목소리가 먼저 필요해요. 혼자 견디지 말고, 지금 바로 이야기를 들어줄 곳에 연락해 보세요.";

// 2026-11 확인: 보건복지부 자살예방상담전화 109(24시간), 정신건강위기상담전화 1577-0199(24시간), 마들랜(SNS 상담)
export const SUPPORT_RESOURCES = [
  { name: "자살예방상담전화", contact: "109", detail: "24시간, 무료" },
  { name: "정신건강위기상담전화", contact: "1577-0199", detail: "24시간" },
  { name: "마들랜 (문자·채팅 상담)", contact: "https://www.129.go.kr/etc/madlan", detail: "전화가 어렵다면" },
  { name: "청소년상담전화", contact: "1388", detail: "24세 이하" },
] as const;
