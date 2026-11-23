import type { RequestHandler } from "express";
import HttpError from "../utils/httpError";

// 추천 하루 횟수 제한: 비로그인은 IP당, 로그인은 사용자당. 한국 시간 자정에 초기화.
// 메모리 저장이므로 서버가 재시작되면 초기화된다(단일 인스턴스 Render 무료 플랜 기준).
const counts = new Map<string, number>();
let currentDay = "";

export function kstDay(now = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function limits() {
  return {
    anon: Number(process.env.DAILY_LIMIT_ANON) || 3,
    user: Number(process.env.DAILY_LIMIT_USER) || 10,
  };
}

export function resetDailyLimits(): void {
  counts.clear();
  currentDay = "";
}

export const dailyLimit: RequestHandler = (req, res, next) => {
  const day = kstDay();
  if (day !== currentDay) {
    counts.clear();
    currentDay = day;
  }
  const key = req.auth ? `user:${req.auth.id}` : `ip:${req.ip ?? "unknown"}`;
  const max = req.auth ? limits().user : limits().anon;
  const used = counts.get(key) ?? 0;
  if (used >= max) {
    return next(new HttpError(429, `오늘 추천 횟수(${max}회)를 모두 사용했어요. 내일 다시 시도해 주세요.`));
  }
  counts.set(key, used + 1);
  res.setHeader("X-Daily-Remaining", String(max - used - 1));
  next();
};
