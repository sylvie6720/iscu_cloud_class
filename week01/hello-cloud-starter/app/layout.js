import "./globals.css";

export const metadata = {
  title: "URL Shortener | Week 02",
  description: "URL 입력값 검증 실습",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
