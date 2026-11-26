import { getSupabase, throwDatabaseError } from "../config/supabase";
import type { ArtworkRow, RecommendationRow } from "../types/database.types";
import HttpError from "../utils/httpError";
import * as ai from "./ai.service";
import { hasRiskKeyword } from "./support.service";
import * as artworks from "./artworks.service";

export type CreateResult =
  | { needsSupport: true }
  | { needsMoreDetail: true; hint: string }
  | { needsMoreDetail: false; recommendation: Recommendation };

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
  // 위기 신호: 키워드는 AI 호출 전에 바로, AI 판단은 결과로 확인한다. 기록은 남기지 않는다.
  if (hasRiskKeyword(sentence)) return { needsSupport: true };
  const analysis = await ai.analyzeEmotion(sentence);
  if (analysis?.riskOfHarm) return { needsSupport: true };
  if (analysis?.needsMoreDetail) return { needsMoreDetail: true, hint: analysis.hint };

  const tags = analysis?.emotionTags ?? [];
  let candidates = tags.length ? await artworks.findCandidates(tags, 10) : [];
  if (!candidates.length) candidates = await artworks.representativeCandidates(10);
  if (!candidates.length) throw new HttpError(503, "추천할 작품이 아직 준비되지 않았습니다.");

  const pick = await ai.pickArtwork(sentence, candidates, tags);
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
  return { needsMoreDetail: false, recommendation: toRecommendation(data as RowWithArtwork, userId) };
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
