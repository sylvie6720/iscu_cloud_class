import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { saveUrl } from "../../../lib/db";

export const runtime = "nodejs";

// "My-App.vercel.app."처럼 끝에 점이 붙은 FQDN 표기도 같은 호스트로 본다.
function normalizeHostname(hostname) {
  return hostname.toLowerCase().replace(/\.+$/, "");
}

const MAX_URL_LENGTH = 2048;

const ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/*
 * createShortCode()
 *
 * 원본 URL을 입력받아 SHA-256 해시를 생성하고,
 * 그 값을 이용해 6자리 short code를 만듭니다.
 */
function createShortCode(originalUrl, length = 6) {
  const hex = createHash("sha256")
    .update(originalUrl)
    .digest("hex");

  let code = "";

  for (let i = 0; i < length; i++) {
    const value = parseInt(
      hex.slice(i * 2, i * 2 + 2),
      16
    );

    code += ALPHABET[value % ALPHABET.length];
  }

  return code;
}

/*
 * POST()
 *
 * 클라이언트가 보낸 URL을 검사하고,
 * 문제가 없으면 short URL을 생성하여 반환합니다.
 */
export async function POST(request) {
  try {

    /*
     * 1. 요청 body 읽기
     *
     * 클라이언트가 보낸 JSON에서
     * originalUrl 값을 가져옵니다.
     */
    const body = await request.json().catch(() => null);

    const raw = body?.originalUrl;
    const originalUrl =
      typeof raw === "string" ? raw.trim() : "";


    /*
     * 2. URL이 입력되지 않은 경우
     *
     * 클라이언트가 필요한 값을 보내지 않은 상황입니다.
     */
    if (!originalUrl) {
      return NextResponse.json(
        {
          error: {
            code: "MISSING_URL",
            message: "Original URL is required.",
          },
        },
        { status: 400 }
      );
    }


    /*
     * 3. URL이 너무 긴 경우
     *
     * 서버가 허용하는 최대 길이보다
     * 긴 URL을 클라이언트가 보낸 상황입니다.
     */
    if (originalUrl.length > MAX_URL_LENGTH) {
      return NextResponse.json(
        {
          error: {
            code: "URL_TOO_LONG",
            message:
              `URL must be ${MAX_URL_LENGTH} characters or fewer.`,
          },
        },
        { status: 400 }
      );
    }


    /*
     * 4. URL 형식 검사
     *
     * new URL()을 이용하여
     * 올바른 URL 형식인지 검사합니다.
     */
    let parsedUrl;

    try {
      parsedUrl = new URL(originalUrl);
    } catch {

      /*
       * 올바른 URL 형식이 아닌 경우
       */
      return NextResponse.json(
        {
          error: {
            code: "INVALID_URL",
            message:
              "URL must start with http:// or https://.",
          },
        },
        { status: 400 }
      );
    }


    /*
     * 5. 프로토콜 검사
     *
     * http 또는 https만 허용합니다.
     */
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {

      /*
       * 허용하지 않는 URL을 보낸 경우
       */
      return NextResponse.json(
        {
          error: {
            code: "INVALID_URL",
            message:
              "URL must start with http:// or https://.",
          },
        },
        { status: 400 }
      );
    }


    /*
     * 6. 자기 서비스 URL 차단
     *
     * 이 서비스의 주소를 다시 단축하면 단축 URL이 자기 자신을 가리키는
     * 리다이렉트 고리가 생길 수 있으므로 거부합니다.
     * 배포 주소를 코드에 고정하지 않고 요청이 들어온 호스트와 비교해야
     * Production URL과 Deployment URL 어느 쪽으로 접속해도 똑같이 동작합니다.
     * 프로토콜(http/https)과 포트는 무시하고 호스트 이름만 비교합니다.
     */
    const baseUrl = new URL(request.url).origin;
    const serviceHostname = normalizeHostname(new URL(request.url).hostname);

    if (normalizeHostname(parsedUrl.hostname) === serviceHostname) {
      return NextResponse.json(
        {
          error: {
            code: "SELF_URL_NOT_ALLOWED",
            message: "URLs of this service cannot be shortened.",
          },
        },
        { status: 400 }
      );
    }


    /*
     * 7. Short URL 생성과 저장
     *
     * 같은 originalUrl이 이미 저장되어 있으면 기존 shortCode를 그대로 반환합니다.
     * 새로 저장한 경우에만 201 Created, 기존 매핑을 돌려준 경우는 200 OK입니다.
     */
    const { shortCode, created } = await saveUrl(
      createShortCode(originalUrl),
      originalUrl
    );

    return NextResponse.json(
      {
        shortCode,
        shortUrl: `${baseUrl}/${shortCode}`,
        originalUrl,
      },
      { status: created ? 201 : 200 }
    );

  } catch (error) {
    // 원본 URL에는 민감한 쿼리 파라미터가 있을 수 있어 로그에 남기지 않는다(6주차 로그 원칙).
    console.error("Failed to create short URL", error);

    /*
     * 8. 서버 내부 오류
     *
     * 예상하지 못한 오류가 발생한 경우입니다.
     */
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to create short URL.",
        },
      },
      { status: 500 }
    );
  }
}
