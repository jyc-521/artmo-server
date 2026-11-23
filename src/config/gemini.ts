import type * as GenAI from "@google/genai" with { "resolution-mode": "import" };
import HttpError from "../utils/httpError";

// @google/genai는 ESM 패키지지만 CommonJS 빌드(require)도 함께 제공한다. 타입만 ESM에서 가져온다.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const genai: typeof GenAI = require("@google/genai");

export const Type = genai.Type;
export type Schema = GenAI.Schema;

export const GEMINI_TIMEOUT_MS = 10_000;

export function recommendModel(): string {
  return process.env.GEMINI_MODEL_RECOMMEND?.trim() || "gemini-3.1-flash-lite";
}

export function taggingModel(): string {
  return process.env.GEMINI_MODEL_TAGGING?.trim() || "gemini-3.5-flash";
}

let client: GenAI.GoogleGenAI | undefined;

export function getGemini(): GenAI.GoogleGenAI {
  if (client) return client;
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey.includes("replace_with")) throw new HttpError(503, "서버의 GEMINI_API_KEY를 설정하세요.");
  client = new genai.GoogleGenAI({ apiKey });
  return client;
}
