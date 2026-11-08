import { findUrlByShortCode } from "../../lib/db";
import { recordClick } from "../../lib/stats";

export async function GET(request, { params }) {
  const { shortCode } = await params;

  const originalUrl = await findUrlByShortCode(shortCode);

  if (!originalUrl) {
    console.warn("Short URL not found", { shortCode });

    return new Response("Not Found", {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }

  // 클릭 기록이 실패해도 사용자 이동은 막지 않는다(6주차 정책 B).
  try {
    await recordClick(shortCode);
  } catch (error) {
    console.error("Failed to record click", { shortCode });
  }

  return new Response(null, {
    status: 307,
    headers: {
      Location: originalUrl,
      "Cache-Control": "no-store",
    },
  });
}
