import type { Request, RequestHandler } from "express";
import { getSupabase, throwDatabaseError } from "../config/supabase";
import { profileResponse } from "../types/auth.types";
import type { ProfileRow } from "../types/database.types";
import HttpError from "../utils/httpError";
import asyncHandler from "../utils/asyncHandler";

function bearerToken(req: Request): string | null | undefined {
  const header = req.get("authorization");
  if (!header) return undefined; // 헤더 없음 = 비로그인
  const match = header.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null; // 형식이 틀린 헤더 = 무효
}

async function verify(req: Request, token: string): Promise<void> {
  const db = getSupabase();
  // 토큰은 Supabase Auth가 검증한다. 디코딩한 값만으로 신원을 인정하지 않는다.
  const { data, error } = await db.auth.getUser(token);
  if (error) {
    if (!error.status || error.status >= 500) throw new HttpError(503, "인증 서버에 연결할 수 없습니다.");
    throw new HttpError(401, "로그인이 만료되었거나 유효하지 않습니다.");
  }
  if (!data.user) throw new HttpError(401, "로그인이 필요합니다.");
  const result = await db.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
  if (result.error) throwDatabaseError(result.error);
  if (!result.data) throw new HttpError(403, "사용자 프로필이 없습니다.");
  const row = result.data as ProfileRow;
  if (!row.is_active) throw new HttpError(403, "비활성화된 계정입니다.");
  req.auth = profileResponse(row);
}

export const isAuthenticated = asyncHandler(async (req, _res, next) => {
  const token = bearerToken(req);
  if (!token) throw new HttpError(401, "로그인이 필요합니다.");
  await verify(req, token);
  next();
});

// 토큰이 없으면 비로그인으로 통과, 토큰이 있으면 isAuthenticated와 같은 검증을 한다.
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = bearerToken(req);
  if (token === undefined) return next();
  if (token === null) throw new HttpError(401, "로그인이 만료되었거나 유효하지 않습니다.");
  await verify(req, token);
  next();
});

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (req.auth?.userType !== "admin") return next(new HttpError(403, "관리자 권한이 필요합니다."));
  next();
};
