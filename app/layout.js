import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "Ôn thi trắc nghiệm — Tạo đề từ tài liệu",
  description: "Up tài liệu ôn thi, web tự tách câu hỏi và đáp án thành bộ đề để luyện tập, thi thử, chia sẻ qua link.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <nav className="topnav">
          <Link href="/" style={{ fontWeight: 800, fontSize: 19, textDecoration: "none", color: "var(--ink)" }}>📚 Ôn Thi</Link>
          <div className="links">
            <Link className="btn" href="/">Trang chủ</Link>
            <Link className="btn" href="/tao-de">➕ Tạo bộ đề</Link>
            <Link className="btn" href="/de/builtin">Bộ 400 câu HCM</Link>
          </div>
        </nav>
        {children}
        <footer>Web ôn thi động — up tài liệu, tự tách câu hỏi, ôn luyện và chia sẻ bộ đề qua link. Tài khoản và bộ đề dùng chung với bản cũ (Firebase).</footer>
      </body>
    </html>
  );
}
