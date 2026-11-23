import { getSupabase, throwDatabaseError } from "../config/supabase";
import type { ArtworkRow } from "../types/database.types";
import type { Candidate } from "./ai.service";
import HttpError from "../utils/httpError";

export function toArtwork(row: ArtworkRow) {
  return {
    id: row.id,
    source: row.source,
    title: row.title,
    artist: row.artist,
    year: row.year,
    medium: row.medium,
    imageUrl: row.image_url,
    sourceUrl: row.source_url,
    emotionTags: row.emotion_tags,
    description: row.description,
    isPublicDomain: row.is_public_domain,
    isVisible: row.is_visible,
  };
}
export type Artwork = ReturnType<typeof toArtwork>;

export async function listArtworks(opts: { tag?: string; limit: number; offset: number }): Promise<Artwork[]> {
  let query = getSupabase().from("artworks").select("*").eq("is_visible", true);
  if (opts.tag) query = query.contains("emotion_tags", [opts.tag]);
  const { data, error } = await query.order("id").range(opts.offset, opts.offset + opts.limit - 1);
  if (error) throwDatabaseError(error);
  return (data as ArtworkRow[]).map(toArtwork);
}

export async function popularArtworks(limit: number): Promise<Artwork[]> {
  const { data, error } = await getSupabase().rpc("artmo_popular_artworks", { p_limit: limit });
  if (error) throwDatabaseError(error);
  return (data as ArtworkRow[]).map(toArtwork);
}

export async function getArtwork(id: number, includeHidden = false): Promise<Artwork> {
  const { data, error } = await getSupabase().from("artworks").select("*").eq("id", id).maybeSingle();
  if (error) throwDatabaseError(error);
  const row = data as ArtworkRow | null;
  if (!row || (!row.is_visible && !includeHidden)) throw new HttpError(404, "작품을 찾을 수 없습니다.");
  return toArtwork(row);
}

export interface ArtworkInput {
  source: "met" | "aic";
  source_id: string;
  title: string;
  artist: string;
  year: string;
  medium: string;
  image_url: string;
  source_url: string;
  emotion_tags: string[];
  description: string;
  is_public_domain: boolean;
}

export async function createArtwork(input: ArtworkInput): Promise<Artwork> {
  const { data, error } = await getSupabase().from("artworks").insert(input).select("*").single();
  if (error) throwDatabaseError(error);
  return toArtwork(data as ArtworkRow);
}

export async function updateArtwork(id: number, patch: Partial<Pick<ArtworkRow, "title" | "artist" | "year" | "emotion_tags" | "description" | "is_visible">>): Promise<Artwork> {
  const { data, error } = await getSupabase().from("artworks").update(patch).eq("id", id).select("*").maybeSingle();
  if (error) throwDatabaseError(error);
  if (!data) throw new HttpError(404, "작품을 찾을 수 없습니다.");
  return toArtwork(data as ArtworkRow);
}

export async function deleteArtwork(id: number): Promise<void> {
  const { data, error } = await getSupabase().from("artworks").delete().eq("id", id).select("id");
  if (error) throwDatabaseError(error);
  if (!data?.length) throw new HttpError(404, "작품을 찾을 수 없습니다.");
}

export async function findCandidates(tags: string[], limit = 10): Promise<Candidate[]> {
  const { data, error } = await getSupabase().rpc("match_artmo_artworks", { p_tags: tags, p_limit: limit });
  if (error) throwDatabaseError(error);
  return data as Candidate[];
}

// 겹치는 태그가 하나도 없을 때 쓰는 대표 작품: 인기 작품 상위에서 하나.
export async function representativeCandidates(limit = 10): Promise<Candidate[]> {
  const popular = await popularArtworks(limit);
  return popular.map((a) => ({ id: a.id, title: a.title, artist: a.artist, year: a.year, emotion_tags: a.emotionTags, description: a.description, score: 0 }));
}

export async function saveArtwork(userId: string, artworkId: number): Promise<void> {
  await getArtwork(artworkId);
  const { error } = await getSupabase().from("saves").upsert({ user_id: userId, artwork_id: artworkId }, { onConflict: "user_id,artwork_id", ignoreDuplicates: true });
  if (error) throwDatabaseError(error);
}

export async function unsaveArtwork(userId: string, artworkId: number): Promise<void> {
  const { error } = await getSupabase().from("saves").delete().eq("user_id", userId).eq("artwork_id", artworkId);
  if (error) throwDatabaseError(error);
}

export async function listSaved(userId: string): Promise<Artwork[]> {
  const { data, error } = await getSupabase()
    .from("saves")
    .select("created_at, artworks(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throwDatabaseError(error);
  return (data as unknown as { artworks: ArtworkRow | null }[])
    .map((r) => r.artworks)
    .filter((a): a is ArtworkRow => !!a && a.is_visible)
    .map(toArtwork);
}
