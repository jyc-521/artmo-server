import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { test, before, beforeEach, after } from "node:test";

const schema = readFileSync(path.join(__dirname, "../supabase/schema.sql"), "utf8");
const seed = readFileSync(path.join(__dirname, "../supabase/seed.sql"), "utf8");
const adminId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
// 로컬 검사용으로만 Supabase Auth의 역할·계정 테이블을 흉내 낸다. 실제 Supabase에는 이미 있다.
const authBootstrap = `create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth; create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb, raw_app_meta_data jsonb);`;

let db: PGlite;
before(async () => {
  db = new PGlite();
  await db.exec(authBootstrap);
  await db.exec(schema);
});
beforeEach(async () => {
  await db.exec("reset role; truncate auth.users, public.profiles, public.artworks, public.recommendations, public.saves, public.sponsorships restart identity cascade;");
  await db.exec(seed);
  await db.query(
    `insert into auth.users values ($1,'admin@example.test','{"name":"관리자"}','{"provider":"email"}'),($2,'user@example.test','{"name":"사용자"}','{"provider":"google"}')`,
    [adminId, userId],
  );
  await db.query("update public.profiles set user_type='admin' where id=$1", [adminId]);
});
after(async () => {
  await db?.close();
});

async function sponsorship(licenseAgreed = true) {
  const { rows } = await db.query<{ id: number }>(
    `insert into public.sponsorships(user_id, title, artist_name, image_url, license_agreed)
     values ($1, '새벽의 바다', '김작가', 'https://example.test/sea.jpg', $2) returning id`,
    [userId, licenseAgreed],
  );
  return rows[0].id;
}

test("빈 DB에 5개 테이블을 만들고, 다시 실행해도 데이터를 보존한다", async () => {
  const fresh = new PGlite();
  try {
    await fresh.exec(authBootstrap);
    await fresh.exec(schema);
    const tables = await fresh.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema='public' order by table_name",
    );
    assert.deepEqual(tables.rows.map((r) => r.table_name), ["artworks", "profiles", "recommendations", "saves", "sponsorships"]);
    await fresh.exec(seed);
    await fresh.exec("update public.artworks set description='보존' where id=1");
    await fresh.exec(schema);
    await fresh.exec(seed);
    const rows = await fresh.query<{ description: string }>("select description from public.artworks order by id");
    assert.equal(rows.rows.length, 3);
    assert.equal(rows.rows[0].description, "보존");
  } finally {
    await fresh.close();
  }
});

test("가입 시 프로필이 생기고 metadata로 관리자 권한을 얻을 수 없다", async () => {
  const id = "33333333-3333-4333-8333-333333333333";
  await db.query(`insert into auth.users values ($1,'x@example.test','{"name":"해커","user_type":"admin"}','{"provider":"email"}')`, [id]);
  const { rows } = await db.query<{ user_type: string; provider: string }>("select user_type, provider from public.profiles where id=$1", [id]);
  assert.equal(rows[0].user_type, "user");
  const google = await db.query<{ provider: string }>("select provider from public.profiles where id=$1", [userId]);
  assert.equal(google.rows[0].provider, "google");
});

test("퍼블릭 도메인이 아닌 일반 작품은 저장할 수 없다", async () => {
  await assert.rejects(
    db.query(`insert into public.artworks(source, source_id, title, image_url, is_public_domain) values ('met','x1','저작권 작품','https://example.test/a.jpg', false)`),
    /artmo_artwork_rights/,
  );
});

test("필수 이용 동의가 없는 협찬 신청은 저장되지 않는다", async () => {
  await assert.rejects(sponsorship(false), /check/i);
});

test("협찬 승인을 두 번 해도 작품은 하나만 생긴다", async () => {
  const id = await sponsorship();
  const first = await db.query<{ id: number; source: string }>("select * from public.approve_artmo_sponsorship($1,$2)", [id, adminId]);
  const second = await db.query<{ id: number }>("select * from public.approve_artmo_sponsorship($1,$2)", [id, adminId]);
  assert.equal(first.rows[0].source, "sponsor");
  assert.equal(second.rows[0].id, first.rows[0].id);
  const count = await db.query<{ n: number }>("select count(*)::int n from public.artworks where source='sponsor'");
  assert.equal(count.rows[0].n, 1);
  const status = await db.query<{ status: string; reviewed_by: string }>("select status, reviewed_by from public.sponsorships where id=$1", [id]);
  assert.equal(status.rows[0].status, "approved");
  assert.equal(status.rows[0].reviewed_by, adminId);
});

test("일반 사용자는 승인할 수 없고, 거절된 신청은 승인되지 않는다", async () => {
  const id = await sponsorship();
  await assert.rejects(db.query("select * from public.approve_artmo_sponsorship($1,$2)", [id, userId]), /REVIEWER_NOT_ADMIN/);
  await db.query("update public.sponsorships set status='rejected' where id=$1", [id]);
  await assert.rejects(db.query("select * from public.approve_artmo_sponsorship($1,$2)", [id, adminId]), /SPONSORSHIP_NOT_PENDING/);
  await assert.rejects(db.query("select * from public.approve_artmo_sponsorship($1,$2)", [9999, adminId]), /SPONSORSHIP_NOT_FOUND/);
});

test("마지막 관리자는 강등하거나 탈퇴할 수 없다", async () => {
  await assert.rejects(db.query("select * from public.set_artmo_user_type($1,'user')", [adminId]), /LAST_ADMIN/);
  await assert.rejects(db.query("select public.deactivate_artmo_account($1)", [adminId]), /LAST_ADMIN/);
  await db.query("select * from public.set_artmo_user_type($1,'admin')", [userId]);
  await db.query("select * from public.set_artmo_user_type($1,'user')", [adminId]);
  const { rows } = await db.query<{ user_type: string }>("select user_type from public.profiles where id=$1", [adminId]);
  assert.equal(rows[0].user_type, "user");
  await assert.rejects(db.query("select * from public.set_artmo_user_type($1,'owner')", [userId]), /INVALID_USER_TYPE/);
});

test("태그가 많이 겹치는 작품 순으로 후보를 주고, 숨긴 작품은 빼준다", async () => {
  const { rows } = await db.query<{ title: string; score: number }>("select * from public.match_artmo_artworks(array['평온','고요','고독'], 10)");
  assert.equal(rows[0].title, "Young Woman with a Water Pitcher");
  assert.equal(rows[0].score, 3);
  assert.equal(rows.length, 2);
  await db.exec("update public.artworks set is_visible=false where title='Young Woman with a Water Pitcher'");
  const hidden = await db.query<{ title: string }>("select * from public.match_artmo_artworks(array['평온','고요','고독'], 10)");
  assert.ok(hidden.rows.every((r) => r.title !== "Young Woman with a Water Pitcher"));
  const none = await db.query("select * from public.match_artmo_artworks(array['분노'], 10)");
  assert.equal(none.rows.length, 0);
});

test("공유 수를 올리고 인기 작품 순서에 반영한다", async () => {
  const { rows } = await db.query<{ id: string }>(
    "insert into public.recommendations(input_text, artwork_id, interpretation) values ('나른한 오후의 기분', 2, '해석') returning id",
  );
  await db.query("select public.increment_artmo_share($1)", [rows[0].id]);
  await db.query("select public.increment_artmo_share($1)", [rows[0].id]);
  const popular = await db.query<{ id: number }>("select * from public.artmo_popular_artworks(10)");
  assert.equal(popular.rows[0].id, 2);
  await assert.rejects(
    db.query("select public.increment_artmo_share($1)", ["99999999-9999-4999-8999-999999999999"]),
    /RECOMMENDATION_NOT_FOUND/,
  );
});

test("저장은 사용자당 작품 1회만 된다", async () => {
  await db.query("insert into public.saves(user_id, artwork_id) values ($1, 1)", [userId]);
  await assert.rejects(db.query("insert into public.saves(user_id, artwork_id) values ($1, 1)", [userId]), /duplicate key/);
});

test("브라우저 역할(anon·authenticated)은 테이블과 함수를 쓸 수 없다", async () => {
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    await assert.rejects(db.query("select * from public.artworks"), /permission denied/);
    await assert.rejects(db.query("select * from public.match_artmo_artworks(array['평온'], 10)"), /permission denied/);
    await db.exec("reset role");
  }
});
