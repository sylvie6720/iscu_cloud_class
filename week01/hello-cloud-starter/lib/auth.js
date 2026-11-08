// lib/auth.js
// 인증(Authentication): 요청을 보낸 사용자가 누구인지 확인합니다.

export function authenticate(request) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Basic ")) {
    return null;
  }

  try {
    // "Basic " 뒤의 Base64 문자열만 분리합니다.
    const encodedCredentials = authHeader.slice("Basic ".length);

    // "admin:비밀번호" 형태의 문자열로 복호화합니다.
    const decodedCredentials = Buffer.from(
      encodedCredentials,
      "base64"
    ).toString("utf-8");

    const separatorIndex = decodedCredentials.indexOf(":");
    if (separatorIndex === -1) {
      return null;
    }

    const username = decodedCredentials.slice(0, separatorIndex);
    const password = decodedCredentials.slice(separatorIndex + 1);

    // ADMIN_PASSWORD가 빈 문자열로 등록된 경우 빈 비밀번호로 로그인되는 것을 막는다.
    const isValidAdmin =
      Boolean(process.env.ADMIN_PASSWORD) &&
      username === "admin" &&
      password === process.env.ADMIN_PASSWORD;

    if (!isValidAdmin) {
      return null;
    }

    return {
      username,
      role: "admin",
    };
  } catch {
    return null;
  }
}
