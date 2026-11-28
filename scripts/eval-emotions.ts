// 시험용 정답 목록(tests/fixtures/emotion-cases.json)을 실제 Gemini로 돌려 감정 분석과 고른 그림을 확인한다.
// 사용: npm run eval:emotions  (GitHub Actions "Evaluate emotions"에서 실행, 키는 Secrets에만)
// 사용자 문장은 시험용 문장만 쓰며, 결과는 로그로만 남고 DB에 저장하지 않는다.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyzeEmotion, pickArtwork } from "../src/services/ai.service";
import { findCandidates, representativeCandidates } from "../src/services/artworks.service";
import { hasRiskKeyword } from "../src/services/support.service";

type Case = { sentence: string; expect?: string[]; avoid?: string[]; support?: boolean };
const { cases } = JSON.parse(readFileSync(join(__dirname, "..", "tests", "fixtures", "emotion-cases.json"), "utf8")) as { cases: Case[] };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let pass = 0;
  for (const [i, c] of cases.entries()) {
    const a = await analyzeEmotion(c.sentence);
    const tags = a?.emotionTags ?? [];
    const support = hasRiskKeyword(c.sentence) || a?.riskOfHarm === true;
    const hit = (c.expect ?? []).filter((t) => tags.includes(t));
    const bad = (c.avoid ?? []).filter((t) => tags.includes(t));
    const ok = a !== null && (!c.expect?.length || hit.length > 0) && bad.length === 0 && (c.support === undefined || c.support === support);
    if (ok) pass++;
    let picked = "-";
    if (a && tags.length) {
      let cands = await findCandidates(tags, 10);
      if (!cands.length) cands = await representativeCandidates(10);
      const p = await pickArtwork(c.sentence, cands, tags, support);
      const art = cands.find((x) => x.id === p.artworkId);
      picked = `${art?.title ?? p.artworkId} / ${art?.artist ?? ""}\n     해석: ${p.interpretation}`;
    }
    console.log(`\n${ok ? "✔" : "✘"} ${i + 1}. ${c.sentence}`);
    console.log(`     감정: ${a ? tags.join(", ") : "(분석 실패)"}${support ? "  [도움 안내]" : ""}`);
    console.log(`     기대: ${(c.expect ?? []).join(", ") || "-"} / 피해야: ${(c.avoid ?? []).join(", ") || "-"}${bad.length ? `  ← 나오면 안 되는 감정: ${bad.join(", ")}` : ""}`);
    console.log(`     그림: ${picked}`);
    await sleep(4000);
  }
  console.log(`\n정답률: ${pass}/${cases.length}`);
}

main().catch((e) => {
  console.error("평가 실패:", e instanceof Error ? e.message : e);
  process.exit(1);
});
