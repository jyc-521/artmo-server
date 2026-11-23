jest.mock("../src/config/supabase", () => ({
  ...jest.requireActual("../src/config/supabase"),
  getSupabase: jest.fn(),
}));
jest.mock("../src/services/artworks.service", () => ({
  ...jest.requireActual("../src/services/artworks.service"),
  listArtworks: jest.fn(), popularArtworks: jest.fn(), getArtwork: jest.fn(), createArtwork: jest.fn(),
  updateArtwork: jest.fn(), deleteArtwork: jest.fn(), saveArtwork: jest.fn(), unsaveArtwork: jest.fn(), listSaved: jest.fn(),
}));
jest.mock("../src/services/recommendations.service");
jest.mock("../src/services/sponsorships.service");
jest.mock("../src/services/users.service");
import request from "supertest";
import createApp from "../src/app";
import { getSupabase } from "../src/config/supabase";
import { resetDailyLimits } from "../src/middleware/rateLimit.middleware";
import * as artworks from "../src/services/artworks.service";
import * as recommendations from "../src/services/recommendations.service";
import * as sponsorships from "../src/services/sponsorships.service";
import * as users from "../src/services/users.service";
import type { ProfileRow } from "../src/types/database.types";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const REC_ID = "33333333-3333-4333-8333-333333333333";
const profile: ProfileRow = {
  id: USER_ID, email: "user@example.test", name: "사용자", avatar: "", provider: "email",
  user_type: "user", is_active: true, created_at: "2026-01-01", updated_at: "2026-01-01",
};
const profileQuery = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn() };
const client = { auth: { getUser: jest.fn() }, from: jest.fn(() => profileQuery) };
const app = createApp();

function asRole(role: "user" | "admin") {
  profileQuery.maybeSingle.mockResolvedValue({ data: { ...profile, user_type: role }, error: null });
}

beforeEach(() => {
  jest.clearAllMocks();
  resetDailyLimits();
  jest.mocked(getSupabase).mockReturnValue(client as unknown as ReturnType<typeof getSupabase>);
  client.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  asRole("user");
  // 서비스는 모의 객체: 라우트까지 도달했는지만 본다.
  for (const mod of [artworks, recommendations, sponsorships, users]) {
    for (const fn of Object.values(mod)) {
      if (jest.isMockFunction(fn)) fn.mockResolvedValue([] as never);
    }
  }
  jest.mocked(recommendations.createRecommendation).mockResolvedValue({ needsMoreDetail: true, hint: "더 적어 주세요" });
});

type Method = "get" | "post" | "put" | "delete";
const call = (method: Method, url: string, token?: string) => {
  const req = request(app)[method](url);
  if (token) req.set("Authorization", `Bearer ${token}`);
  return req.send({});
};

// PRD 5-3 권한표 · references/role-matrix.md
const adminRoutes: [Method, string][] = [
  ["get", "/api/users/all"],
  ["put", `/api/users/${USER_ID}/type`],
  ["post", "/api/artworks"],
  ["put", "/api/artworks/1"],
  ["delete", "/api/artworks/1"],
  ["get", "/api/sponsorships"],
  ["post", "/api/sponsorships/1/approve"],
  ["put", "/api/sponsorships/1"],
];
const userRoutes: [Method, string][] = [
  ["get", "/api/auth/me"],
  ["get", "/api/users/profile"],
  ["put", "/api/users/profile"],
  ["delete", "/api/users/account"],
  ["get", "/api/recommendations/me"],
  ["get", "/api/artworks/saved"],
  ["post", "/api/artworks/1/save"],
  ["delete", "/api/artworks/1/save"],
  ["post", "/api/sponsorships"],
  ["get", "/api/sponsorships/me"],
];
const publicRoutes: [Method, string][] = [
  ["get", "/health"],
  ["get", "/api/auth/providers"],
  ["get", "/api/artworks"],
  ["get", "/api/artworks/popular"],
  ["get", "/api/artworks/tags"],
  ["get", "/api/artworks/1"],
  ["get", "/api/artworks/1/image"],
  ["get", `/api/recommendations/${REC_ID}`],
  ["post", `/api/recommendations/${REC_ID}/share`],
];

describe("관리자 전용 경로", () => {
  test.each(adminRoutes)("비로그인 %s %s → 401", async (m, url) => {
    expect((await call(m, url)).status).toBe(401);
  });
  test.each(adminRoutes)("일반 사용자 %s %s → 403", async (m, url) => {
    expect((await call(m, url, "user-token")).status).toBe(403);
  });
  test.each(adminRoutes)("관리자 %s %s → 401·403 아님", async (m, url) => {
    asRole("admin");
    const res = await call(m, url, "admin-token");
    expect([401, 403]).not.toContain(res.status);
  });
});

describe("로그인 필요 경로", () => {
  test.each(userRoutes)("비로그인 %s %s → 401", async (m, url) => {
    expect((await call(m, url)).status).toBe(401);
  });
  test.each(userRoutes)("일반 사용자 %s %s → 401·403 아님", async (m, url) => {
    const res = await call(m, url, "user-token");
    expect([401, 403]).not.toContain(res.status);
  });
});

describe("공개 경로", () => {
  test.each(publicRoutes)("비로그인 %s %s → 401·403 아님", async (m, url) => {
    const res = await call(m, url);
    expect([401, 403]).not.toContain(res.status);
  });
});

describe("인증 미들웨어", () => {
  test("무효 토큰은 401", async () => {
    client.auth.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401, message: "bad" } });
    expect((await call("get", "/api/auth/me", "bad-token")).status).toBe(401);
  });
  test("Auth 서버 장애는 503", async () => {
    client.auth.getUser.mockResolvedValue({ data: { user: null }, error: { status: 500, message: "down" } });
    expect((await call("get", "/api/auth/me", "token")).status).toBe(503);
  });
  test("비활성 계정은 403", async () => {
    profileQuery.maybeSingle.mockResolvedValue({ data: { ...profile, is_active: false }, error: null });
    expect((await call("get", "/api/auth/me", "token")).status).toBe(403);
  });
  test("optionalAuth: 무효 토큰을 비로그인으로 취급하지 않는다", async () => {
    client.auth.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401, message: "bad" } });
    const res = await request(app).post("/api/recommendations").set("Authorization", "Bearer bad").send({ sentence: "수평선 앞의 고독한 사람" });
    expect(res.status).toBe(401);
  });
  test("optionalAuth: 형식이 틀린 Authorization 헤더는 401", async () => {
    const res = await request(app).post("/api/recommendations").set("Authorization", "Basic abc").send({ sentence: "수평선 앞의 고독한 사람" });
    expect(res.status).toBe(401);
  });
  test("요청자 ID는 req.auth에서만: 본문의 userId는 무시한다", async () => {
    await request(app).post("/api/recommendations").set("Authorization", "Bearer t").send({ sentence: "수평선 앞의 고독한 사람", userId: "99999999-9999-4999-8999-999999999999" });
    expect(recommendations.createRecommendation).toHaveBeenCalledWith("수평선 앞의 고독한 사람", USER_ID);
  });
  test("내 추천 기록은 토큰의 사용자 ID로만 조회한다", async () => {
    await request(app).get("/api/recommendations/me?userId=99999999-9999-4999-8999-999999999999").set("Authorization", "Bearer t");
    expect(recommendations.listMine).toHaveBeenCalledWith(USER_ID);
  });
});

describe("추천 하루 횟수 제한", () => {
  const send = (token?: string) => {
    const req = request(app).post("/api/recommendations");
    if (token) req.set("Authorization", `Bearer ${token}`);
    return req.send({ sentence: "수평선 앞의 고독한 사람" });
  };
  test("비로그인은 IP당 하루 3회, 4번째는 429", async () => {
    for (let i = 0; i < 3; i++) expect((await send()).status).toBe(200);
    expect((await send()).status).toBe(429);
  });
  test("로그인 사용자는 하루 10회, 11번째는 429", async () => {
    for (let i = 0; i < 10; i++) expect((await send("t")).status).toBe(200);
    expect((await send("t")).status).toBe(429);
  });
});

describe("입력 검증", () => {
  test.each([["ㅇㅇ"], ["가".repeat(201)], [""], [123]])("기분 문장 %p → 400", async (sentence) => {
    const res = await request(app).post("/api/recommendations").send({ sentence });
    expect(res.status).toBe(400);
    expect(recommendations.createRecommendation).not.toHaveBeenCalled();
  });
  test("필수 이용 동의 없는 협찬 신청 → 400", async () => {
    const res = await request(app).post("/api/sponsorships").set("Authorization", "Bearer t")
      .send({ title: "작품", artistName: "작가", imageUrl: "https://example.test/a.jpg", licenseAgreed: false });
    expect(res.status).toBe(400);
    expect(sponsorships.createSponsorship).not.toHaveBeenCalled();
  });
  test("협찬 이미지는 https 주소만 → 400", async () => {
    const res = await request(app).post("/api/sponsorships").set("Authorization", "Bearer t")
      .send({ title: "작품", artistName: "작가", imageUrl: "javascript:alert(1)", licenseAgreed: true });
    expect(res.status).toBe(400);
  });
  test("굿즈 동의는 기본 false", async () => {
    await request(app).post("/api/sponsorships").set("Authorization", "Bearer t")
      .send({ title: "작품", artistName: "작가", imageUrl: "https://example.test/a.jpg", licenseAgreed: true });
    expect(sponsorships.createSponsorship).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ license_agreed: true, goods_consent: false }));
  });
  test("관리자 역할 변경 값 검증 → 400", async () => {
    asRole("admin");
    const res = await request(app).put(`/api/users/${USER_ID}/type`).set("Authorization", "Bearer t").send({ userType: "owner" });
    expect(res.status).toBe(400);
  });
  test("잘못된 JSON → 400", async () => {
    const res = await request(app).post("/api/recommendations").set("Content-Type", "application/json").send("{bad");
    expect(res.status).toBe(400);
  });
});

describe("응답 형식과 앱 설정", () => {
  test("/health → { status: ok }", async () => {
    const res = await request(app).get("/health");
    expect(res.body).toEqual({ status: "ok" });
  });
  test("없는 경로 → 404 { error: { message } }", async () => {
    const res = await request(app).get("/api/nothing");
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBeDefined();
  });
  test("오류 응답 형식 { success: false, message, error }", async () => {
    const res = await call("get", "/api/auth/me");
    expect(res.body).toEqual({ success: false, message: expect.any(String), error: { message: expect.any(String) } });
  });
  test("작품 삭제 → 204 빈 본문", async () => {
    asRole("admin");
    const res = await call("delete", "/api/artworks/1", "t");
    expect(res.status).toBe(204);
    expect(res.text).toBe("");
  });
  test("CORS: 허용 목록에 없는 출처에는 허용 헤더를 주지 않는다", async () => {
    const res = await request(app).get("/health").set("Origin", "https://evil.example");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    const ok = await request(app).get("/health").set("Origin", "http://localhost:5173");
    expect(ok.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(ok.headers["access-control-allow-credentials"]).toBeUndefined();
  });
  test("소셜 로그인 목록에 비밀값이 없다", async () => {
    process.env.AUTH_PROVIDERS = "google";
    const res = await request(app).get("/api/auth/providers");
    expect(res.body).toEqual({ data: { email: true, google: true, naver: false } });
    expect(res.headers["cache-control"]).toBe("no-store");
  });
});

describe("작품 이미지 전달 (공유 카드용)", () => {
  const MET = "https://images.metmuseum.org/CRDImages/ep/web-large/a.jpg";
  const fetchMock = jest.fn();
  beforeEach(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockResolvedValue(new Response(Buffer.from("img"), { headers: { "content-type": "image/jpeg" } }));
    jest.mocked(artworks.getArtwork).mockResolvedValue({ imageUrl: MET } as never);
  });
  test.each([["비로그인", undefined], ["일반 사용자", "user-token"], ["관리자", "admin-token"]])("%s → 200 이미지", async (_who, token) => {
    if (token === "admin-token") asRole("admin");
    const req = request(app).get("/api/artworks/1/image").set("Origin", "http://localhost:5173");
    if (token) req.set("Authorization", `Bearer ${token}`);
    const res = await req;
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/jpeg");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(fetchMock).toHaveBeenCalledWith(MET, expect.objectContaining({ redirect: "manual" }));
  });
  test.each([
    "https://evil.example/a.jpg",
    "http://images.metmuseum.org/a.jpg",
    "https://images.metmuseum.org:8443/a.jpg",
    "https://user:pw@images.metmuseum.org/a.jpg",
    "https://169.254.169.254/latest",
  ])("허용 목록 밖 주소 %s → 404, 외부 요청 없음", async (url) => {
    jest.mocked(artworks.getArtwork).mockResolvedValue({ imageUrl: url } as never);
    expect((await request(app).get("/api/artworks/1/image")).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  test("이미지가 아닌 응답 → 502", async () => {
    fetchMock.mockResolvedValue(new Response("<html>", { headers: { "content-type": "text/html" } }));
    expect((await request(app).get("/api/artworks/1/image")).status).toBe(502);
  });
  test("리다이렉트·네트워크 실패 → 502", async () => {
    fetchMock.mockRejectedValue(new TypeError("redirect"));
    expect((await request(app).get("/api/artworks/1/image")).status).toBe(502);
  });
  test("허용 목록 안 리다이렉트는 따라가고, 밖이면 502", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "/b.jpg" } }));
    expect((await request(app).get("/api/artworks/1/image")).status).toBe(200);
    expect(fetchMock).toHaveBeenLastCalledWith("https://images.metmuseum.org/b.jpg", expect.anything());
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://evil.example/x.jpg" } }));
    expect((await request(app).get("/api/artworks/1/image")).status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  test("잘못된 id → 400", async () => {
    expect((await request(app).get("/api/artworks/abc/image")).status).toBe(400);
  });
});
