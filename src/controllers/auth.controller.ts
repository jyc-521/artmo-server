import type { Request, Response } from "express";
import asyncHandler from "../utils/asyncHandler";

const KNOWN = ["google", "naver"] as const;

// 로그인 화면에 보여줄 소셜 로그인 목록. 비밀값 없이 켜진 공급자 이름만 돌려준다.
export function providers(_req: Request, res: Response): void {
  const enabled = new Set((process.env.AUTH_PROVIDERS ?? "").split(",").map((v) => v.trim().toLowerCase()));
  res.set("Cache-Control", "no-store");
  res.json({ data: { email: true, google: enabled.has(KNOWN[0]), naver: enabled.has(KNOWN[1]) } });
}

export const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.auth });
});
