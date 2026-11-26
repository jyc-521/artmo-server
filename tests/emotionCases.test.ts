// 정답 목록의 위기 신호 판정이 서버 키워드 검사와 어긋나지 않는지 확인한다(AI 없이).
// 감정 태그 정확도는 실제 Gemini가 필요해 여기서는 보지 않는다.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hasRiskKeyword } from "../src/services/support.service";
import { ALLOWED_TAGS } from "../src/services/ai.service";

type Case = { sentence: string; expect?: string[]; avoid?: string[]; support?: boolean };
const cases = JSON.parse(readFileSync(join(__dirname, "fixtures", "emotion-cases.json"), "utf8")) as { cases: Case[] };
const tags = new Set<string>(ALLOWED_TAGS);

test.each(cases.cases.filter((c) => c.support !== undefined).map((c) => [c.sentence, c.support] as const))("위기 판정: %s → %s", (sentence, support) => {
  expect(hasRiskKeyword(sentence)).toBe(support);
});

test("정답 목록의 감정은 모두 허용 목록 안에 있다", () => {
  for (const c of cases.cases) {
    for (const t of [...(c.expect ?? []), ...(c.avoid ?? [])]) expect(tags.has(t)).toBe(true);
  }
});
