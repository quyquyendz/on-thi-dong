"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AuthBox from "../components/AuthBox";
import { useAuth } from "../lib/useAuth";
import { listBanks, listResults, getLeaderboard, deleteBank } from "../lib/banks";

export default function HomePage() {
  const user = useAuth();
  const [banks, setBanks] = useState(null);
  const [results, setResults] = useState(null);
  const [board, setBoard] = useState(null);

  useEffect(() => {
    if (!user) { setBanks(null); setResults(null); return; }
    listBanks(user.uid).then(setBanks).catch(() => setBanks([]));
    listResults(user.uid).then(setResults).catch(() => setResults([]));
    getLeaderboard().then(setBoard).catch(() => setBoard([]));
  }, [user]);

  const stats = results && results.length ? (() => {
    let sum = 0, n = 0, best = 0;
    results.forEach((r) => { const m = String(r.score).match(/^(\d+)\/(\d+)/); if (m && +m[2]) { const p = +m[1] / +m[2]; sum += p; n++; if (p > best) best = p; } });
    return { times: results.length, best: Math.round(best * 100), avg: n ? Math.round(sum / n * 100) : 0 };
  })() : null;

  async function onDelete(id, name) {
    if (!confirm("Xoá bộ đề “" + name + "”?")) return;
    await deleteBank(id);
    setBanks((b) => (b || []).filter((x) => x.id !== id));
  }

  return (
    <main>
      <div className="hero">
        <div style={{ fontSize: 34 }}>🎓</div>
        <h1>Ôn thi trắc nghiệm — tự tạo đề từ tài liệu</h1>
        <p>Up Word, PDF, TXT — web tách câu hỏi và đáp án thành bộ đề, mỗi bộ đề có một đường link riêng để làm bài và chia sẻ.</p>
        <div className="stats"><span>✔ Có sẵn bộ 400 câu Hồ Chí Minh</span><span>✔ Giữ hình trong câu hỏi</span><span>✔ Đồng bộ tài khoản cũ</span></div>
      </div>

      <AuthBox />

      <section className="card">
        <h2><span className="num">1</span> Bộ đề có sẵn</h2>
        <div className="bank-row">
          <div><b>Bộ 400 câu Tư tưởng Hồ Chí Minh</b><div className="muted" style={{ fontSize: 14 }}>Chương 2–6 · có chế độ thi thử 50 câu / 60 phút · phòng thi & Olympia ở bản web cũ</div></div>
          <Link className="btn primary" href="/de/builtin">Làm bài →</Link>
        </div>
        <div className="bank-row">
          <div><b>Tạo bộ đề mới từ tài liệu của bạn</b><div className="muted" style={{ fontSize: 14 }}>Word (.docx), PDF, TXT, HTML, JSON — tự tách câu hỏi, giữ hình ảnh</div></div>
          <Link className="btn" href="/tao-de">Tạo đề →</Link>
        </div>
      </section>

      {user && (
        <section className="card">
          <h2><span className="num">2</span> Bộ đề của tôi</h2>
          {banks === null && <p className="muted">Đang tải…</p>}
          {banks && banks.length === 0 && <p className="muted">Chưa có bộ đề nào. Bấm “Tạo đề” ở trên để up tài liệu đầu tiên.</p>}
          {banks && banks.map((b) => (
            <div className="bank-row" key={b.id}>
              <div><b>{b.name}</b><div className="muted" style={{ fontSize: 14 }}>{b.count} câu</div></div>
              <div className="bank-acts">
                <Link className="btn primary" href={"/de/" + b.id}>Làm bài</Link>
                <button className="btn" onClick={() => onDelete(b.id, b.name)}>Xoá</button>
              </div>
            </div>
          ))}
          {stats && (
            <>
              <h3 style={{ margin: "18px 0 6px" }}>Lịch sử làm bài</h3>
              <p className="muted" style={{ margin: "0 0 10px" }}>Đã làm {stats.times} lần · Điểm cao nhất {stats.best}% · Trung bình {stats.avg}%</p>
              {results.slice(0, 8).map((r, i) => (
                <div className="hrow" key={i}><div className="hmain"><div className="htitle">{r.title}</div><div className="hdate">{r.date}</div></div><div className="hscore">{r.score}</div></div>
              ))}
            </>
          )}
        </section>
      )}

      {user && board && board.length > 0 && (
        <section className="card">
          <h2>🏆 Bảng xếp hạng</h2>
          <p className="muted sub">Điểm tốt nhất (theo % đúng) của các bạn đã đăng nhập và làm bài.</p>
          <ol className="board">
            {board.map((r, i) => (
              <li key={r.uid}><span className="rk">{["🥇", "🥈", "🥉"][i] || (i + 1) + "."}</span><span className="nm">{r.name}{r.uid === user.uid ? " (bạn)" : ""}</span><span className="sc">{r.score} · {r.pct}%</span></li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}
