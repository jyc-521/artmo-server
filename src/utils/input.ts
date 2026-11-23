import HttpError from "./httpError";

export const SENTENCE_MIN = 5;
export const SENTENCE_MAX = 200;

export function objectBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new HttpError(400, "JSON 객체를 입력하세요.");
  return value as Record<string, unknown>;
}

export function textField(value: unknown, field: string, opts: { required?: boolean; min?: number; max?: number } = {}): string {
  const { required = false, min = required ? 1 : 0, max = 2000 } = opts;
  if (value === undefined || value === null || value === "") {
    if (required) throw new HttpError(400, `'${field}' 값을 입력하세요.`);
    return "";
  }
  if (typeof value !== "string") throw new HttpError(400, `'${field}' 값이 올바르지 않습니다.`);
  const text = value.trim();
  if (text.length < min || text.length > max)
    throw new HttpError(400, `'${field}'은(는) ${min}자 이상 ${max}자 이하로 입력하세요.`);
  return text;
}

export function sentenceField(value: unknown): string {
  if (typeof value !== "string") throw new HttpError(400, "기분 문장을 입력하세요.");
  const text = value.trim();
  if (text.length < SENTENCE_MIN || text.length > SENTENCE_MAX)
    throw new HttpError(400, `기분 문장은 ${SENTENCE_MIN}자 이상 ${SENTENCE_MAX}자 이하로 입력하세요.`);
  return text;
}

export function httpsUrlField(value: unknown, field: string): string {
  const text = textField(value, field, { required: true, max: 1000 });
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new HttpError(400, `'${field}'은(는) 올바른 주소가 아닙니다.`);
  }
  if (url.protocol !== "https:") throw new HttpError(400, `'${field}'은(는) https 주소만 허용합니다.`);
  return url.toString();
}

export function booleanField(value: unknown, field: string, fallback = false): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "boolean") throw new HttpError(400, `'${field}' 값이 올바르지 않습니다.`);
  return value;
}

export function numericId(value: string): number {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)))
    throw new HttpError(400, "ID는 양의 정수여야 합니다.");
  return Number(value);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function uuid(value: string, label = "ID"): string {
  if (!UUID_RE.test(value)) throw new HttpError(400, `${label}가 올바르지 않습니다.`);
  return value;
}
