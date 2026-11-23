// Supabase 연결과 스키마 적용 여부를 확인한다. 실제 DB를 부르므로 .env가 준비된 경우에만 실행한다.
import "dotenv/config";
import { getSupabase } from "../src/config/supabase";

async function main() {
  const db = getSupabase();
  for (const table of ["profiles", "artworks", "recommendations", "saves", "sponsorships"]) {
    const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
    console.log(error ? `✗ ${table}: ${error.code ?? error.message}` : `✓ ${table}: ${count}행`);
  }
  const { data, error } = await db.rpc("match_artmo_artworks", { p_tags: ["평온"], p_limit: 1 });
  console.log(error ? `✗ match_artmo_artworks: ${error.code ?? error.message}` : `✓ match_artmo_artworks: ${data.length}건`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
