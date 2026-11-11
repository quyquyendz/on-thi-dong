"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import QuizEngine from "../../../components/QuizEngine";
import { useAuth } from "../../../lib/useAuth";
import { loadBank, saveResult, deleteBank, setBankShared } from "../../../lib/banks";
import DATA400 from "../../../lib/data400.json";

const CH_LABEL = { "2": "Cơ sở và quá trình hình thành", "3": "Độc lập dân tộc và CNXH", "4": "Đảng và Nhà nước", "5": "Đại đoàn kết, quốc tế", "6": "Văn hóa, đạo đức, con người" };
function builtinBank() {
  const qs = [];
  Object.keys(DATA400).forEach((k) => DATA400[k].forEach((q) => qs.push({ q: q.q, opts: q.opts, a: q.a, chapter: k })));
  return {
    id: "builtin",
    name: "Bộ 400 câu Tư tưởng Hồ Chí Minh",
    questions: qs,
    chapters: [
      ...Object.keys(DATA400).map((k) => ({ key: k, label: "Chương " + k, sub: CH_LABEL[k] || "" })),
      { key: "both", label: "Tất cả", sub: "Ch. 2–6" },
    ],
  };
}

export default function DePage({ params }) {
  const id = params.id;
  const user = useAuth();
  const [bank, setBank] = useState(null);
  const [err, setErr] = useState("");
  const [shared, setShared] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (id === "builtin") { setBank(builtinBank()); return; }
    if (id === "draft") {
      try {
        const d = JSON.parse(localStorage.getItem("onthi_draft_bank") || "null");
        if (d && d.questions && d.questions.length) setBank({ id: "draft", name: d.name || "Bộ đề từ tài liệu", questions: d.questions });
        else setErr("Không tìm thấy bản nháp — hãy tạo bộ đề trước.");
      } catch (e) { setErr("Không đọc được bản nháp."); }
      return;
    }
    if (user === undefined) return; // doi xac dinh dang nhap
    loadBank(id).then((b) => {
      if (!b) { setErr("Không mở được bộ đề này — có thể bộ đề là riêng tư của người khác, hoặc đã bị xoá."); return; }
      setBank(b); setShared(!!b.shared);
    }).catch(() => setErr("Không mở được bộ đề này — có thể bộ đề là riêng tư của người khác, hoặc đã bị xoá."));
  }, [id, user]);

  async function onFinish(scoreText) {
    if (user && bank) { try { await saveResult(user.uid, user.displayName || (user.email || "").split("@")[0], scoreText, bank.name); } catch (e) {} }
  }

  async function toggleShare() {
    const next = !shared;
    try { await setBankShared(id, next); setShared(next); } catch (e) { alert("Không đổi được trạng thái chia sẻ: " + e.message); }
  }
  function copyLink() {
    const url = window.location.origin + "/de/" + id;
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => setCopied(true)).catch(() => {});
  }
  async function onDelete() {
    if (!confirm("Xoá bộ đề “" + bank.name + "”?")) return;
    await deleteBank(id);
    window.location.href = "/";
  }

  const isOwner = user && bank && bank.owner === user.uid;

  return (
    <main>
      <div className="hero" style={{ padding: "20px 18px 14px" }}>
        <h1 style={{ fontSize: 23 }}>{bank ? bank.name : "Bộ đề"}</h1>
        {bank && <p>{bank.questions.length} câu · Link riêng: /de/{id}</p>}
      </div>

      {isOwner && (
        <section className="card">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <b>Quản lý bộ đề:</b>
            <button className="btn" onClick={toggleShare}>{shared ? "🔗 Đang chia sẻ qua link (bấm để tắt)" : "🔒 Riêng tư (bấm để bật chia sẻ qua link)"}</button>
            {shared && <button className="btn" onClick={copyLink}>{copied ? "✓ Đã chép link" : "Chép link chia sẻ"}</button>}
            <button className="btn" onClick={onDelete}>Xoá bộ đề</button>
          </div>
          <p className="muted" style={{ margin: "8px 0 0", fontSize: 14 }}>Khi bật chia sẻ, bất kỳ ai có link /de/{id} đều mở và làm được bộ đề này (không cần là chủ sở hữu). Lịch sử của họ lưu ở tài khoản của họ.</p>
        </section>
      )}

      {err && <section className="card"><p className="auth-err" style={{ fontSize: 16 }}>{err}</p><p><Link href="/">← Về trang chủ</Link> · <Link href="/tao-de">Tạo bộ đề mới</Link></p></section>}
      {!bank && !err && <section className="card"><p className="muted">Đang tải bộ đề…</p></section>}
      {bank && <QuizEngine bankId={id} title={bank.name} questions={bank.questions} chapters={bank.chapters || null} onFinish={onFinish} />}
    </main>
  );
}
