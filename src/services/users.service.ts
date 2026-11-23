import { getSupabase, throwDatabaseError } from "../config/supabase";
import { profileResponse, type AppUser } from "../types/auth.types";
import type { ProfileRow } from "../types/database.types";
import HttpError from "../utils/httpError";

export async function getProfile(id: string): Promise<AppUser> {
  const { data, error } = await getSupabase().from("profiles").select("*").eq("id", id).maybeSingle();
  if (error) throwDatabaseError(error);
  if (!data) throw new HttpError(404, "사용자를 찾을 수 없습니다.");
  return profileResponse(data as ProfileRow);
}

export async function updateProfile(id: string, patch: { name?: string; avatar?: string }): Promise<AppUser> {
  const { data, error } = await getSupabase().from("profiles").update(patch).eq("id", id).select("*").maybeSingle();
  if (error) throwDatabaseError(error);
  if (!data) throw new HttpError(404, "사용자를 찾을 수 없습니다.");
  return profileResponse(data as ProfileRow);
}

export async function deactivate(id: string): Promise<void> {
  const { error } = await getSupabase().rpc("deactivate_artmo_account", { p_user_id: id });
  if (error) throwDatabaseError(error);
}

export async function listAll(): Promise<AppUser[]> {
  const { data, error } = await getSupabase().from("profiles").select("*").order("created_at", { ascending: false });
  if (error) throwDatabaseError(error);
  return (data as ProfileRow[]).map(profileResponse);
}

export async function changeType(userId: string, userType: "user" | "admin"): Promise<AppUser> {
  const { data, error } = await getSupabase().rpc("set_artmo_user_type", { p_user_id: userId, p_user_type: userType });
  if (error) throwDatabaseError(error);
  const row = (data as ProfileRow[])[0];
  if (!row) throw new HttpError(404, "사용자를 찾을 수 없습니다.");
  return profileResponse(row);
}
