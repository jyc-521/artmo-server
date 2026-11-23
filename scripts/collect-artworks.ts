// 작품 수집: 메트로폴리탄·시카고 미술관에서 이미지가 있는 퍼블릭 도메인 회화를 모아
// Gemini로 감정 태그·해설을 만들고, 자동 검증을 통과한 작품만 artworks에 저장한다.
//
//   npm run collect:artworks                 # 미술관별 250점, 총 500점 목표
//   npm run collect:artworks -- --per 20     # 미술관별 20점만
//   npm run collect:artworks -- --dry-run    # 저장하지 않고 결과만 출력
//
// 실제 Supabase·Gemini·미술관 API를 부르므로 .env가 준비된 경우에만 실행한다.
import "dotenv/config";
import { getSupabase } from "../src/config/supabase";
import { tagArtwork, type ArtworkMeta } from "../src/services/ai.service";

const args = process.argv.slice(2);
const PER_MUSEUM = Number(args[args.indexOf("--per") + 1]) || 250;
const DRY_RUN = args.includes("--dry-run");
const USER_AGENT = "ARTMO student project (Ajou University web service course)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Found {
  source: "met" | "aic";
  sourceId: string;
  meta: ArtworkMeta;
  imageUrl: string;
  sourceUrl: string;
  isPublicDomain: boolean;
}

// 네트워크가 잠깐 끊기거나 429·5xx가 오면 잠시 쉬었다가 최대 3번 다시 시도한다.
async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  let last: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(20_000),
        headers: { "User-Agent": USER_AGENT, "AIC-User-Agent": USER_AGENT, ...(init?.headers ?? {}) },
      });
      if (res.ok) return (await res.json()) as T;
      last = new Error(`HTTP ${res.status} ${new URL(url).hostname}`);
      if (res.status !== 429 && res.status < 500) break;
    } catch (e) {
      last = e;
    }
    await sleep(2000 * attempt);
  }
  throw last instanceof Error ? last : new Error(String(last));
}

// Gemini 오류를 짧은 이유로 바꾼다. 상태 코드와 앞부분만 남기고 키 같은 값은 담기지 않는다.
function geminiReason(e: unknown): string {
  const err = e as { status?: unknown; name?: unknown; message?: unknown };
  if (err?.name === "TimeoutError" || err?.name === "AbortError") return "시간 초과";
  const status = typeof err?.status === "number" ? String(err.status) : "";
  const msg = typeof err?.message === "string" ? err.message.replace(/AIza[\w-]+/g, "[key]").slice(0, 80) : String(e).slice(0, 80);
  return status ? `${status} ${msg}` : msg;
}

// 건너뛴 이유를 세어 마지막에 보여 준다(원인 파악용).
const reasons = new Map<string, number>();
const skip = (why: string) => reasons.set(why, (reasons.get(why) ?? 0) + 1);

const MET = "https://collectionapi.metmuseum.org/public/collection";

// 메트로폴리탄 작품 ID 순서: 유럽 회화(11)·미국관(1)·근현대(21)의 대표작 먼저, 그다음 부서 전체 목록.
// v1/search는 2026-10-01에 종료되어 v1.1/search(offset·limit 페이지)와 v1/objects를 쓴다.
async function* metIds(): AsyncGenerator<number> {
  for (const dept of [11, 1, 21]) {
    for (let offset = 0; offset < 1000; offset += 100) {
      const { objectIDs } = await getJson<{ objectIDs: number[] | null }>(
        `${MET}/v1.1/search?q=painting&departmentId=${dept}&hasImages=true&isHighlight=true&limit=100&offset=${offset}`,
      );
      if (!objectIDs?.length) break;
      yield* objectIDs;
    }
  }
  for (const dept of [11, 1]) {
    const { objectIDs } = await getJson<{ objectIDs: number[] | null }>(`${MET}/v1/objects?departmentIds=${dept}`);
    yield* objectIDs ?? [];
  }
}

async function* metPaintings(): AsyncGenerator<Found> {
  const seen = new Set<number>();
  for await (const id of metIds()) {
    if (seen.has(id)) continue;
    seen.add(id);
    await sleep(100); // 공식 권장 초당 80회보다 훨씬 느리게
    const o = await getJson<Record<string, string | boolean>>(`${MET}/v1/objects/${id}`).catch(() => null);
    if (!o || o.isPublicDomain !== true || o.classification !== "Paintings" || !o.primaryImageSmall) continue;
    yield {
      source: "met",
      sourceId: String(id),
      meta: { title: String(o.title), artist: String(o.artistDisplayName || "작자 미상"), year: String(o.objectDate ?? ""), medium: String(o.medium ?? "") },
      imageUrl: String(o.primaryImageSmall),
      sourceUrl: String(o.objectURL ?? ""),
      isPublicDomain: true,
    };
  }
}

// 시카고: 퍼블릭 도메인 회화, 대표작(is_boosted) 먼저
async function* aicPaintings(): AsyncGenerator<Found> {
  for (const boosted of [true, false]) {
    for (let page = 1; page <= 20; page++) {
      // artwork_type_title은 분석되는 텍스트 필드라 term("Painting")은 대소문자가 안 맞아 0건이 된다. match로 찾는다.
      const filter: unknown[] = [{ term: { is_public_domain: true } }, { exists: { field: "image_id" } }];
      if (boosted) filter.push({ term: { is_boosted: true } });
      const body = {
        query: { bool: { must: [{ match: { artwork_type_title: "Painting" } }], filter } },
        fields: ["id", "title", "artist_title", "date_display", "medium_display", "image_id", "is_public_domain"],
        limit: 50,
        page,
      };
      const res = await getJson<{ data: Record<string, unknown>[] }>("https://api.artic.edu/api/v1/artworks/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (page === 1) console.log(`시카고 검색(대표작=${boosted}): ${res.data.length}건부터 시작`);
      if (!res.data.length) break;
      for (const a of res.data) {
        if (a.is_public_domain !== true || !a.image_id) continue;
        yield {
          source: "aic",
          sourceId: String(a.id),
          meta: { title: String(a.title), artist: String(a.artist_title || "작자 미상"), year: String(a.date_display ?? ""), medium: String(a.medium_display ?? "") },
          imageUrl: `https://www.artic.edu/iiif/2/${a.image_id}/full/843,/0/default.jpg`,
          sourceUrl: `https://www.artic.edu/artworks/${a.id}`,
          isPublicDomain: true,
        };
      }
      await sleep(500);
    }
  }
}

// 자동 검증 1: 이미지 주소가 실제로 열리는 https 이미지인지
async function fetchImage(url: string): Promise<{ mimeType: string; data: string } | null> {
  if (!url.startsWith("https://")) { skip("이미지: https 아님"); return null; }
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(20_000) });
    if (res.status !== 200) { skip(`이미지: HTTP ${res.status} ${new URL(url).hostname}`); return null; }
    const mimeType = res.headers.get("content-type")?.split(";")[0] ?? "";
    if (!mimeType.startsWith("image/")) { skip(`이미지: 형식 ${mimeType || "없음"}`); return null; }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1000 || buf.length > 8_000_000) { skip("이미지: 크기 범위 밖"); return null; }
    return { mimeType, data: buf.toString("base64") };
  } catch {
    skip(`이미지: 네트워크 실패 ${new URL(url).hostname}`);
    return null;
  }
}

async function existingKeys(): Promise<Set<string>> {
  const keys = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await getSupabase().from("artworks").select("source, source_id").range(from, from + 999);
    if (error) throw new Error(`기존 작품 조회 실패: ${error.code ?? ""}`);
    for (const r of data) keys.add(`${r.source}:${r.source_id}`);
    if (data.length < 1000) break;
  }
  return keys;
}

async function collect(name: string, source: AsyncGenerator<Found>, existing: Set<string>) {
  let saved = 0;
  let skipped = 0;
  let tagFailStreak = 0;
  try {
    for await (const art of source) {
      if (saved >= PER_MUSEUM) break;
      const key = `${art.source}:${art.sourceId}`;
      if (existing.has(key)) { skipped++; continue; } // 이미 저장된 작품은 건너뛴다
      if (!art.isPublicDomain) { skipped++; continue; } // 자동 검증 2: 퍼블릭 도메인
      const image = await fetchImage(art.imageUrl);
      if (!image) { skipped++; continue; }
      // 자동 검증 3: JSON 형식·허용 태그·해설 안전성. 분당 한도(429)면 잠시 쉬고 한 번 더 시도한다.
      let failure = "";
      const onError = (e: unknown) => { failure = geminiReason(e); };
      let tagged = await tagArtwork(art.meta, image, onError);
      if (!tagged && failure.startsWith("429")) {
        await sleep(30_000);
        tagged = await tagArtwork(art.meta, image, onError);
      }
      if (!tagged) {
        skip(`Gemini: ${failure || "알 수 없음"}`);
        skipped++;
        // 연속 실패는 대개 Gemini 무료 등급 하루 한도 초과다. 계속 돌면 미술관 API만 낭비하므로 멈춘다. 다음 날 다시 실행하면 이어서 모은다.
        if (++tagFailStreak >= 10) { console.warn(`${name}: Gemini 태깅이 10번 연속 실패해 중단합니다(하루 한도 초과 가능). 내일 다시 실행하세요.`); break; }
        continue;
      }
      tagFailStreak = 0;
      const row = {
        source: art.source, source_id: art.sourceId, title: art.meta.title.slice(0, 300), artist: art.meta.artist.slice(0, 200),
        year: art.meta.year.slice(0, 50), medium: art.meta.medium.slice(0, 200), image_url: art.imageUrl, source_url: art.sourceUrl,
        emotion_tags: tagged.emotionTags, description: tagged.description, is_public_domain: true,
      };
      if (DRY_RUN) {
        console.log(`[dry-run] ${name} ${art.sourceId} ${row.title} → ${row.emotion_tags.join(", ")}`);
      } else {
        const { error } = await getSupabase().from("artworks").insert(row);
        if (error) { skipped++; console.warn(`저장 실패 ${key}: ${error.code ?? ""}`); continue; }
      }
      existing.add(key);
      saved++;
      if (saved % 25 === 0) console.log(`${name}: ${saved}/${PER_MUSEUM}`);
      await sleep(4000); // Gemini 무료 등급 분당 요청 수(약 15회)를 넘지 않게
    }
  } catch (e) {
    // 한 미술관 API가 막혀도 다른 미술관 수집은 계속한다.
    console.warn(`${name}: 목록 조회 중단 (${e instanceof Error ? e.message : e})`);
  }
  console.log(`${name}: 저장 ${saved}점, 건너뜀 ${skipped}점`);
  return saved;
}

async function main() {
  const existing = DRY_RUN ? new Set<string>() : await existingKeys();
  const met = await collect("메트로폴리탄", metPaintings(), existing);
  const aic = await collect("시카고", aicPaintings(), existing);
  if (reasons.size) console.log("건너뛴 이유:", Object.fromEntries(reasons));
  console.log(`완료: 총 ${met + aic}점${DRY_RUN ? " (dry-run, 저장 안 함)" : ""}`);
}

main().catch((e) => {
  console.error("수집 중단:", e instanceof Error ? e.message : e);
  process.exit(1);
});
