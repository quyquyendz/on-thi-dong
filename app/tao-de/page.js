"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { bpParseText, bpParse, bpRichFromHtml, bpRichFromText } from "../../lib/parser";
import { useAuth } from "../../lib/useAuth";
import { saveBank } from "../../lib/banks";

const LET = ["A", "B", "C", "D"];

function shrinkOne(src) {
  return new Promise((resolve) => {
    if (!src || src.indexOf("data:") !== 0 || src.length <= 60000) return resolve(src);
    const im = new Image();
    im.onload = () => {
      try {
        const scale = Math.min(1, 900 / Math.max(im.width, im.height));
        if (scale >= 1 && src.length <= 400000) return resolve(src);
        const c = document.createElement("canvas");
        c.width = Math.round(im.width * scale); c.height = Math.round(im.height * scale);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.8));
      } catch (e) { resolve(src); }
    };
    im.onerror = () => resolve(src);
    im.src = src;
  });
}
async function shrinkBankImages(qs) {
  for (const q of qs) {
    if (q.imgs) { const out = []; for (const s of q.imgs) out.push(await shrinkOne(s)); q.imgs = out; }
    if (q.optImgs) for (let oi = 0; oi < q.optImgs.length; oi++) { if (q.optImgs[oi]) { const out = []; for (const s of q.optImgs[oi]) out.push(await shrinkOne(s)); q.optImgs[oi] = out; } }
  }
  return qs;
}

async function readBankFile(file) {
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".docx")) {
    const mammoth = (await import("mammoth")).default || (await import("mammoth"));
    const buf = await file.arrayBuffer();
    const r = await mammoth.convertToHtml({ arrayBuffer: buf }, { convertImage: mammoth.images.imgElement((img) => img.read("base64").then((b) => ({ src: "data:" + img.contentType + ";base64," + b }))) });
    return bpParse(bpRichFromHtml(r.value));
  }
  if (name.endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    let lines = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      let cur = null;
      tc.items.forEach((it) => {
        const bold = /bold|black|heavy/i.test(it.fontName || "");
        if (!cur || it.hasEOL || Math.abs((cur._y || 0) - it.transform[5]) > 3) { cur = { t: "", bold: false, _y: it.transform[5] }; lines.push(cur); }
        cur.t += (cur.t && !cur.t.endsWith(" ") ? " " : "") + it.str;
        if (bold && it.str.trim()) cur.bold = true;
      });
    }
    lines = lines.map((l) => ({ t: String(l.t || "").replace(/\s+/g, " ").trim(), bold: !!l.bold })).filter((l) => l.t);
    return bpParse(lines);
  }
  const text = new TextDecoder("utf-8").decode(await file.arrayBuffer());
  return bpParseText(text);
}

export default function TaoDePage() {
  const router = useRouter();
  const user = useAuth();
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [qs, setQs] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const valid = qs ? qs.filter((q) => q.a >= 0 && q.opts.length === 4).length : 0;

  async function doParse(fromFile) {
    setNote("");
    let src = text;
    if (fromFile) {
      const f = fileRef.current && fileRef.current.files && fileRef.current.files[0];
      if (!f) { setNote("Hãy chọn một file tài liệu trước."); return; }
      setBusy(true);
      try {
        let parsed = await readBankFile(f);
        parsed = await shrinkBankImages(parsed);
        if (!name) setName(f.name.replace(/\.[^.]+$/, ""));
        setQs(parsed);
        setNote(parsed.length ? "" : "Không tách được câu hỏi nào — kiểm tra lại định dạng tài liệu.");
      } catch (e) { setNote("Không đọc được file: " + (e && e.message ? e.message : e)); }
      setBusy(false);
      return;
    }
    if (!src.trim()) { setNote("Dán nội dung vào ô bên dưới, hoặc chọn file."); return; }
    const parsed = bpParseText(src);
    setQs(await shrinkBankImages(parsed));
    if (!parsed.length) setNote("Không tách được câu hỏi nào từ nội dung đã dán.");
  }

  function playNow() {
    const good = qs.filter((q) => q.a >= 0 && q.opts.length === 4);
    if (!good.length) { setNote("Chưa có câu hoàn chỉnh nào (đủ 4 phương án + có đáp án)."); return; }
    try { localStorage.setItem("onthi_draft_bank", JSON.stringify({ name: name || "Bộ đề từ tài liệu", questions: good })); } catch (e) { setNote("Trình duyệt không lưu được bản nháp (bộ nhớ đầy?). Hãy bấm Lưu bộ đề thay thế."); return; }
    router.push("/de/draft");
  }

  async function save() {
    if (!user) { setNote("Hãy đăng nhập ở trang chủ trước khi lưu bộ đề."); return; }
    const good = qs.filter((q) => q.a >= 0 && q.opts.length === 4);
    if (!good.length) { setNote("Chưa có câu hoàn chỉnh nào để lưu."); return; }
    if (JSON.stringify(good).length > 900000) { setNote("Bộ đề quá lớn (nhiều hình) — hãy tách tài liệu thành 2 phần."); return; }
    setBusy(true);
    try {
      const id = await saveBank(user.uid, name || "Bộ đề từ tài liệu", good);
      router.push("/de/" + id);
    } catch (e) { setNote("Lưu thất bại: " + (e && e.message ? e.message : e)); }
    setBusy(false);
  }

  return (
    <main>
      <section className="card">
        <h2>➕ Tạo bộ đề từ tài liệu</h2>
        <p className="muted sub">Up file Word (.docx), PDF, TXT/HTML/JSON — web tự tách câu hỏi, phương án và đáp án. File Word giữ nguyên hình ảnh trong câu hỏi. Đáp án được nhận diện qua dòng “Đáp án: X”, phương án in đậm/gạch chân, dấu ✔, *, (đúng) hoặc bảng đáp án cuối tài liệu. <Link href="/">← Về trang chủ</Link></p>
        <label className="field">Chọn file tài liệu
          <input type="file" ref={fileRef} accept=".txt,.docx,.pdf,.json,.html,.htm" />
        </label>
        <label className="field">…hoặc dán nội dung câu hỏi vào đây
          <textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Dán văn bản chứa câu hỏi, ví dụ:\nCâu 1: Nội dung câu hỏi?\nA. ...\nB. ...\nC. ...\nD. ...\nĐáp án: A"} />
        </label>
        <label className="field">Tên bộ đề
          <input className="field-input" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Kỹ thuật đo lường — Chương 2" />
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn primary" onClick={() => doParse(true)} disabled={busy}>Tách câu hỏi từ file</button>
          <button className="btn" onClick={() => doParse(false)} disabled={busy}>Tách từ nội dung đã dán</button>
        </div>
        {note && <p className="auth-err">{note}</p>}
      </section>

      {qs && (
        <section className="card">
          <h2>Xem trước bộ đề</h2>
          <p className="muted">Tách được <b>{qs.length}</b> câu · hoàn chỉnh (đủ 4 phương án + đáp án): <b>{valid}</b> · chưa có đáp án: <b>{qs.length - valid}</b>. Câu viền đỏ là câu chưa hoàn chỉnh — bấm vào một phương án để gán đáp án, hoặc xoá câu lỗi.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0 16px" }}>
            <button className="btn primary" onClick={playNow}>▶ Làm ngay</button>
            <button className="btn" onClick={save} disabled={busy}>{user ? "💾 Lưu bộ đề" : "💾 Lưu bộ đề (cần đăng nhập)"}</button>
            <button className="btn" onClick={() => setQs(qs.filter((q) => q.a >= 0 && q.opts.length === 4))}>🧹 Xoá câu lỗi</button>
          </div>
          <div>
            {qs.map((q, i) => {
              const bad = !(q.a >= 0 && q.opts.length === 4);
              return (
                <div className={"bp-item" + (bad ? " bad" : "")} key={i}>
                  <div className="bp-head"><b>Câu {i + 1}.</b><span>{q.q}</span>
                    <button className="bp-del" title="Xoá câu này" onClick={() => setQs(qs.filter((_, j) => j !== i))}>✕</button>
                  </div>
                  {q.imgs && q.imgs.length > 0 && (
                    <div className="bp-imgs">{q.imgs.map((src, ii) => (
                      <span className="bp-imgwrap" key={ii}><img src={src} alt="Hình câu hỏi" /><button className="bp-imgdel" title="Xoá hình này" onClick={() => { const nq = qs.slice(); nq[i] = { ...q, imgs: q.imgs.filter((_, j) => j !== ii) }; setQs(nq); }}>✕</button></span>
                    ))}</div>
                  )}
                  <div className="bp-opts">
                    {q.opts.map((o, oi) => (
                      <button key={oi} className={"bp-opt" + (q.a === oi ? " correct" : "")} title="Bấm để gán đây là đáp án" onClick={() => { const nq = qs.slice(); nq[i] = { ...q, a: oi }; setQs(nq); }}>
                        {LET[oi]}. {String(o).slice(0, 120)}
                        {q.optImgs && q.optImgs[oi] && q.optImgs[oi].length > 0 && <span style={{ display: "block" }}>🖼️ có hình</span>}
                      </button>
                    ))}
                    {q.a < 0 && <span className="muted" style={{ alignSelf: "center" }}>— chưa có đáp án, bấm vào phương án đúng</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
