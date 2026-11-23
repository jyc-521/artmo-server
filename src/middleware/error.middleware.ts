import type { ErrorRequestHandler } from "express";

const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  // 잘못된 JSON 본문은 400으로 돌려준다.
  if (err && typeof err === "object" && "type" in err && err.type === "entity.parse.failed") {
    res.status(400).json({ success: false, message: "JSON 형식이 올바르지 않습니다.", error: { message: "JSON 형식이 올바르지 않습니다." } });
    return;
  }
  const error = err instanceof Error ? err : new Error("서버 오류가 발생했습니다.");
  const status = "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : 500;
  // 500대 내부 오류는 원문을 감추고 일반 문구만 보낸다.
  const message = status >= 500 && status !== 503 ? "서버 오류가 발생했습니다." : error.message;
  if (status >= 500) console.error("[error]", status, error.name);
  res.status(status).json({ success: false, message, error: { message } });
};

export default errorHandler;
