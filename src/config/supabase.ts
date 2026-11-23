import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import HttpError from "../utils/httpError";

let client: SupabaseClient | undefined;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key || url.includes("your-project-ref") || key.includes("replace_with")) {
    throw new HttpError(503, "서버의 SUPABASE_URL과 SUPABASE_SECRET_KEY를 설정하세요.");
  }
  // 서버 SDK는 사용자 세션을 보관·갱신하지 않는다. 요청마다 토큰을 검증한다.
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}

export function throwDatabaseError(error: { code?: string; message: string }): never {
  const m = error.message;
  if (m.includes("REVIEWER_NOT_ADMIN")) throw new HttpError(403, "활성 관리자만 심사할 수 있습니다.");
  if (m.includes("LAST_ADMIN")) throw new HttpError(409, "마지막 관리자의 권한을 해제하거나 계정을 비활성화할 수 없습니다.");
  if (m.includes("USER_NOT_FOUND")) throw new HttpError(404, "사용자를 찾을 수 없습니다.");
  if (m.includes("INACTIVE_USER")) throw new HttpError(409, "비활성 계정의 권한을 변경할 수 없습니다.");
  if (m.includes("SPONSORSHIP_NOT_FOUND")) throw new HttpError(404, "협찬 신청을 찾을 수 없습니다.");
  if (m.includes("SPONSORSHIP_NOT_PENDING")) throw new HttpError(409, "대기 중인 신청만 심사할 수 있습니다.");
  if (m.includes("RECOMMENDATION_NOT_FOUND")) throw new HttpError(404, "추천 기록을 찾을 수 없습니다.");
  if (error.code === "23505") throw new HttpError(409, "이미 등록되었거나 처리된 데이터입니다.");
  if (["23502", "23503", "23514", "22P02"].includes(error.code ?? ""))
    throw new HttpError(400, "입력값 또는 참조한 데이터가 올바르지 않습니다.");
  console.error("[supabase]", error.code ?? "request");
  throw new HttpError(503, "데이터베이스 요청에 실패했습니다.");
}
