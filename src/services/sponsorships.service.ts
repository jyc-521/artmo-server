import { getSupabase, throwDatabaseError } from "../config/supabase";
import type { ArtworkRow, SponsorshipRow } from "../types/database.types";
import HttpError from "../utils/httpError";
import { toArtwork } from "./artworks.service";

export function toSponsorship(row: SponsorshipRow) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    artistName: row.artist_name,
    imageUrl: row.image_url,
    description: row.description,
    licenseAgreed: row.license_agreed,
    goodsConsent: row.goods_consent,
    status: row.status,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}
export type Sponsorship = ReturnType<typeof toSponsorship>;

export interface SponsorshipInput {
  title: string;
  artist_name: string;
  image_url: string;
  description: string;
  license_agreed: true;
  goods_consent: boolean;
}

export async function createSponsorship(userId: string, input: SponsorshipInput): Promise<Sponsorship> {
  const { data, error } = await getSupabase().from("sponsorships").insert({ ...input, user_id: userId }).select("*").single();
  if (error) throwDatabaseError(error);
  return toSponsorship(data as SponsorshipRow);
}

export async function listMine(userId: string): Promise<Sponsorship[]> {
  const { data, error } = await getSupabase().from("sponsorships").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throwDatabaseError(error);
  return (data as SponsorshipRow[]).map(toSponsorship);
}

export async function listAll(status?: SponsorshipRow["status"]): Promise<Sponsorship[]> {
  let query = getSupabase().from("sponsorships").select("*");
  if (status) query = query.eq("status", status);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throwDatabaseError(error);
  return (data as SponsorshipRow[]).map(toSponsorship);
}

export async function approve(id: number, reviewerId: string) {
  const { data, error } = await getSupabase().rpc("approve_artmo_sponsorship", { p_sponsorship_id: id, p_reviewer_id: reviewerId });
  if (error) throwDatabaseError(error);
  const row = (data as ArtworkRow[])[0];
  if (!row) throw new HttpError(409, "승인 결과를 확인할 수 없습니다.");
  return toArtwork(row);
}

export async function reject(id: number, reviewerId: string): Promise<Sponsorship> {
  const { data, error } = await getSupabase()
    .from("sponsorships")
    .update({ status: "rejected", reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (error) throwDatabaseError(error);
  if (!data) throw new HttpError(409, "대기 중인 신청만 거절할 수 있습니다.");
  return toSponsorship(data as SponsorshipRow);
}
