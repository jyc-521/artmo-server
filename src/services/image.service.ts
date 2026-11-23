import HttpError from "../utils/httpError";

// 공유 카드(PNG)를 만들려면 브라우저가 작품 이미지를 CORS로 받아야 하는데, 미술관 이미지 서버는 CORS 헤더를 주지 않는다.
// 그래서 서버가 DB에 저장된 작품 이미지만 대신 받아 전달한다. 임의 주소 요청(SSRF)을 막으려고 호스트 허용 목록을 둔다.
const MAX_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 10_000;

function allowedHosts(): Set<string> {
  const hosts = new Set(["images.metmuseum.org", "www.artic.edu"]);
  try {
    if (process.env.SUPABASE_URL) hosts.add(new URL(process.env.SUPABASE_URL).hostname);
  } catch { /* 잘못된 SUPABASE_URL은 무시 */ }
  return hosts;
}

export function isProxyableImage(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password && !url.port && allowedHosts().has(url.hostname);
  } catch {
    return false;
  }
}

export async function fetchArtworkImage(raw: string): Promise<{ contentType: string; body: Buffer }> {
  if (!isProxyableImage(raw)) throw new HttpError(404, "이 작품 이미지는 전달할 수 없습니다.");
  let res: Response;
  try {
    // 리다이렉트를 따라가면 허용 목록 밖으로 나갈 수 있으므로 막는다.
    res = await fetch(raw, { redirect: "error", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new HttpError(502, "작품 이미지를 불러오지 못했습니다.");
  }
  const contentType = res.headers.get("content-type") ?? "";
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (!res.ok || !/^image\/(jpeg|png|webp|gif)\b/.test(contentType) || declared > MAX_BYTES) {
    throw new HttpError(502, "작품 이미지를 불러오지 못했습니다.");
  }
  const body = Buffer.from(await res.arrayBuffer());
  if (body.length > MAX_BYTES) throw new HttpError(502, "작품 이미지를 불러오지 못했습니다.");
  return { contentType: contentType.split(";")[0], body };
}
