import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

// 같은 originalUrl이 이미 있으면 새 행을 만들지 않고 기존 shortCode를 돌려준다.
// "먼저 SELECT로 확인 후 INSERT"는 두 요청이 동시에 들어오면 둘 다 "없음"으로 보고
// INSERT를 시도할 수 있으므로, INSERT ... ON CONFLICT DO NOTHING으로 DB가 판정하게 한다.
export async function saveUrl(shortCode, originalUrl) {
  const inserted = await sql`
    INSERT INTO urls (short_code, original_url)
    VALUES (${shortCode}, ${originalUrl})
    ON CONFLICT DO NOTHING
    RETURNING short_code
  `;

  if (inserted.length > 0) {
    return { shortCode: inserted[0].short_code, created: true };
  }

  const existing = await sql`
    SELECT short_code
    FROM urls
    WHERE original_url = ${originalUrl}
    LIMIT 1
  `;

  if (existing.length > 0) {
    return { shortCode: existing[0].short_code, created: false };
  }

  // INSERT가 충돌했는데 같은 originalUrl 행이 없다면, 다른 URL이 같은 shortCode를 이미 쓰고 있는 해시 충돌이다.
  throw new Error("shortCode collision with a different originalUrl");
}

export async function findUrlByShortCode(shortCode) {
  const rows = await sql`
    SELECT original_url
    FROM urls
    WHERE short_code = ${shortCode}
    LIMIT 1
  `;

  return rows[0]?.original_url ?? null;
}
