// public 스키마 행 타입. supabase/schema.sql과 함께 바꾼다.
export interface ProfileRow {
  id: string;
  email: string;
  name: string;
  avatar: string;
  provider: string;
  user_type: "user" | "admin";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ArtworkRow {
  id: number;
  source: "met" | "aic" | "sponsor";
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
  is_visible: boolean;
  source_sponsorship_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface RecommendationRow {
  id: string;
  user_id: string | null;
  input_text: string;
  emotion_tags: string[];
  artwork_id: number;
  interpretation: string;
  used_fallback: boolean;
  shared_count: number;
  created_at: string;
}

export interface SaveRow {
  user_id: string;
  artwork_id: number;
  created_at: string;
}

export interface SponsorshipRow {
  id: number;
  user_id: string;
  title: string;
  artist_name: string;
  image_url: string;
  description: string;
  license_agreed: boolean;
  goods_consent: boolean;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}
