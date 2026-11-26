import { getSupabase, throwDatabaseError } from "../config/supabase";
import type { ArtworkRow, RecommendationRow } from "../types/database.types";
import HttpError from "../utils/httpError";
import * as ai from "./ai.service";
import { hasRiskKeyword } from "./support.service";
import * as artworks from "./artworks.service";

export type CreateResult =
  | { needsMoreDetail: true; hint: string }
  | { needsMoreDetail: false; recommendation: Recommendation; support: boolean };

// 위기 신호 문장에서 분석이 실패했을 때 쓰는 감정, 그리고 그런 순간에 내보이지 않을 작품 제목(죽음·처형 장면 등).
// 마음을 닮은 그림은 주되, 죽음 자체를 그린 그림은 주지 않는다.
const SUPPORT_FALLBACK_TAGS = ["슬픔", "고독", "지침", "쓸쓸함"];
const HEAVY_TITLE = /death|dead|dying|suicide|martyr|execution|crucifixion|entombment|lamentation|pietà|pieta|lucretia|cleopatra|ophelia|skull|vanitas|massacre|murder|죽음/i;

type RowWithArtwork = RecommendationRow & { artworks: ArtworkRow | null };

function toRecommendation(row: RowWithArtwork, viewerId?: string) {
  return {
    id: row.id,
    inputText: row.input_text,
    emotionTags: row.emotion_tags,
    interpretation: row.interpretation,
    sharedCount: row.shared_count,
    createdAt: row.created_at,
    isMine: !!viewerId && row.user_id === viewerId,
    artwork: row.artworks ? artworks.toArtwork(row.artworks) : null,
  };
}
export type Recommendation = ReturnType<typeof toRecommendation>;

export async function createRecommendation(sentence: string, userId?: string): Promise<CreateResult> {
  // 위기 신호(키워드 또는 AI 판단): 다른 문장처럼 마음을 닮은 그림을 주고, 도움받을 곳은 화면에 조용히 함께 보인다.
  const keywordRisk = hasRiskKeyword(sentence);
  const analysis = await ai.analyzeEmotion(sentence);
  const support = keywordRisk || analysis?.riskOfHarm === true;
  if (!support && analysis?.needsMoreDetail) return { needsMoreDetail: true, hint: analysis.hint };

  const analyzed = analysis?.emotionTags ?? [];
  const tags = support && !analyzed.length ? SUPPORT_FALLBACK_TAGS : analyzed;
  let candidates = tags.length ? await artworks.findCandidates(tags, 10) : [];
  if (support) candidates = candidates.filter((c) => !HEAVY_TITLE.test(c.title));
  if (!candidates.length) candidates = await artworks.representativeCandidates(10);
  if (!candidates.length) throw new HttpError(503, "추천할 작품이 아직 준비되지 않았습니다.");

  const pick = await ai.pickArtwork(sentence, candidates, tags, support);
  const { data, error } = await getSupabase()
    .from("recommendations")
    .insert({
      user_id: userId ?? null,
      input_text: sentence,
      emotion_tags: tags,
      artwork_id: pick.artworkId,
      interpretation: pick.interpretation,
      used_fallback: pick.usedFallback || !analysis,
    })
    .select("*, artworks(*)")
    .single();
  if (error) throwDatabaseError(error);
  return { needsMoreDetail: false, recommendation: toRecommendation(data as RowWithArtwork, userId), support };
}

export async function getRecommendation(id: string, viewerId?: string): Promise<Recommendation> {
  const { data, error } = await getSupabase().from("recommendations").select("*, artworks(*)").eq("id", id).maybeSingle();
  if (error) throwDatabaseError(error);
  if (!data) throw new HttpError(404, "추천 기록을 찾을 수 없습니다.");
  return toRecommendation(data as RowWithArtwork, viewerId);
}

// 소유권: 요청자 ID로만 필터링한다.
export async function listMine(userId: string): Promise<Recommendation[]> {
  const { data, error } = await getSupabase()
    .from("recommendations")
    .select("*, artworks(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throwDatabaseError(error);
  return (data as RowWithArtwork[]).map((r) => toRecommendation(r, userId));
}

export async function recordShare(id: string): Promise<void> {
  const { error } = await getSupabase().rpc("increment_artmo_share", { p_recommendation_id: id });
  if (error) throwDatabaseError(error);
}
