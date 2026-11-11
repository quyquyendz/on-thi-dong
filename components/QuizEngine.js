"use client";
import { useEffect, useMemo, useRef, useState } from "react";

const LETTERS = ["A", "B", "C", "D"];
function shuffleArr(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function fmt(s) { return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(Math.max(s % 60, 0)).padStart(2, "0"); }

export default function QuizEngine({ bankId, title, questions, chapters, onFinish }) {
  const [phase, setPhase] = useState("setup");
  const [chapter, setChapter] = useState(chapters ? (chapters.some((c) => c.key === "both") ? "both" : chapters[0].key) : null);
  const [countSel, setCountSel] = useState("40");
  const [modeSel, setModeSel] = useState("study");
  const [shuffleQs, setShuffleQs] = useState(true);
  const [shuffleOpts, setShuffleOpts] = useState(true);
  const [items, setItems] = useState([]);
  const [answers, setAnswers] = useState({});
  const [mode, setMode] = useState("study");
  const [isMock, setIsMock] = useState(false);
  const [mockLeft, setMockLeft] = useState(3600);
  const [elapsed, setElapsed] = useState(0);
  const [singleIdx, setSingleIdx] = useState(0);
  const [singleWrong, setSingleWrong] = useState({});
  const [singleTried, setSingleTried] = useState({});
  const [singleFirstPick, setSingleFirstPick] = useState({});
  const [singleFirst, setSingleFirst] = useState(0);
  const [singleLastCorrect, setSingleLastCorrect] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showWrongOnly, setShowWrongOnly] = useState(false);
  const [resume, setResume] = useState(null);
  const finishedRef = useRef(false);
  const SKEY = useMemo(() => "onthi_session_" + bankId, [bankId]);

  const pool = useMemo(() => {
    if (!chapters) return questions || [];
    if (chapter === "both") return questions || [];
    return (questions || []).filter((q) => String(q.chapter) === String(chapter));
  }, [questions, chapters, chapter]);

  /* ---- session: tim ban dang do khi vao trang ---- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SKEY);
      if (raw) { const d = JSON.parse(raw); if (d && Array.isArray(d.items) && d.items.length) setResume(d); }
    } catch (e) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [SKEY]);

  /* ---- dong ho ---- */
  useEffect(() => {
    if (phase !== "quiz" || submitted) return undefined;
    const id = setInterval(() => {
      if (isMock) {
        setMockLeft((s) => {
          if (s <= 1) { clearInterval(id); submitRef.current && submitRef.current(true); return 0; }
          return s - 1;
        });
      } else setElapsed((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isMock, submitted]);

  /* ---- luu phien dang lam ---- */
  useEffect(() => {
    if (phase !== "quiz" || submitted) return;
    try {
      localStorage.setItem(SKEY, JSON.stringify({ items, answers, mode, isMock, mockLeft, singleIdx, singleWrong, singleTried, singleFirstPick, singleFirst, savedAt: Date.now() }));
    } catch (e) {
      try {
        const slim = JSON.parse(JSON.stringify({ items, answers, mode, isMock, mockLeft, singleIdx, singleWrong, singleTried, singleFirstPick, singleFirst }, (k, v) => (k === "imgs" || k === "optImgs" ? undefined : v)));
        localStorage.setItem(SKEY, JSON.stringify(slim));
      } catch (e2) {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, items, answers, mockLeft, singleIdx, singleWrong, singleFirst, submitted]);

  function prepare(srcPool, count, shQ, shO) {
    let list = srcPool.slice();
    if (shQ) list = shuffleArr(list);
    const n = count === "all" ? list.length : Math.min(parseInt(count, 10) || list.length, list.length);
    return list.slice(0, n).map((q) => {
      if (!shO) return { ...q };
      const order = shuffleArr([0, 1, 2, 3]);
      return { q: q.q, chapter: q.chapter, opts: order.map((i) => q.opts[i]), a: order.indexOf(q.a), imgs: q.imgs, optImgs: q.optImgs ? order.map((i) => q.optImgs[i]) : undefined };
    });
  }

  function start(opts) {
    const o = opts || {};
    const m = o.mock ? "test" : modeSel;
    const list = prepare(o.src || pool, o.mock ? "50" : countSel, shuffleQs, shuffleOpts);
    if (!list.length) return;
    setItems(list);
    setAnswers({}); setSingleIdx(0); setSingleWrong({}); setSingleTried({}); setSingleFirstPick({}); setSingleFirst(0); setSingleLastCorrect(false);
    setMode(m); setIsMock(!!o.mock); setMockLeft(3600); setElapsed(0);
    setSubmitted(false); setShowWrongOnly(false); finishedRef.current = false;
    setPhase("quiz");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function restoreSession() {
    if (!resume) return;
    setItems(resume.items); setAnswers(resume.answers || {});
    setMode(resume.mode || "study"); setIsMock(!!resume.isMock); setMockLeft(resume.mockLeft || 3600);
    setSingleIdx(resume.singleIdx || 0); setSingleWrong(resume.singleWrong || {}); setSingleTried(resume.singleTried || {});
    setSingleFirstPick(resume.singleFirstPick || {}); setSingleFirst(resume.singleFirst || 0); setSingleLastCorrect(false);
    setSubmitted(false); finishedRef.current = false; setResume(null);
    setPhase("quiz");
  }

  function finish(scoreCorrect) {
    setSubmitted(true);
    setPhase("result");
    try { localStorage.removeItem(SKEY); } catch (e) {}
    if (!finishedRef.current && onFinish) {
      finishedRef.current = true;
      onFinish(scoreCorrect + "/" + items.length);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function submit(auto) {
    if (mode === "single") return;
    if (isMock && !auto) {
      const done = items.filter((_, i) => answers[i] !== undefined).length;
      if (done < items.length) { alert("Thi thử phải chọn đủ " + items.length + " câu mới nộp được. Bạn mới làm " + done + " câu."); return; }
    }
    const correct = items.reduce((s, q, i) => s + (answers[i] === q.a ? 1 : 0), 0);
    finish(correct);
  }
  const submitRef = useRef(null);
  submitRef.current = submit;

  function pickSingle(qi, oi) {
    if (submitted || singleLastCorrect) return;
    if ((singleWrong[qi] || []).includes(oi)) return;
    const first = !singleTried[qi];
    if (first) { setSingleTried((t) => ({ ...t, [qi]: true })); setSingleFirstPick((p) => ({ ...p, [qi]: oi })); }
    if (oi === items[qi].a) {
      if (first) setSingleFirst((c) => c + 1);
      setAnswers((a) => ({ ...a, [qi]: oi }));
      setSingleLastCorrect(true);
      setTimeout(() => {
        setSingleLastCorrect(false);
        if (singleIdx + 1 >= items.length) finish(singleFirst + (first ? 1 : 0));
        else setSingleIdx((i) => i + 1);
      }, 900);
    } else {
      setSingleWrong((w) => ({ ...w, [qi]: [...(w[qi] || []), oi] }));
    }
  }

  function pick(qi, oi) {
    if (submitted) return;
    if (mode === "single") return pickSingle(qi, oi);
    setAnswers((a) => ({ ...a, [qi]: oi }));
  }

  const wrongItems = useMemo(() => {
    if (phase !== "result") return [];
    return items.map((q, i) => ({ q, i })).filter(({ q, i }) => (mode === "single" ? singleFirstPick[i] !== q.a : answers[i] !== q.a));
  }, [phase, items, answers, singleFirstPick, mode]);

  const resultCorrect = useMemo(() => {
    if (phase !== "result") return 0;
    if (mode === "single") return singleFirst;
    return items.reduce((s, q, i) => s + (answers[i] === q.a ? 1 : 0), 0);
  }, [phase, items, answers, mode, singleFirst]);

  /* ================= RENDER ================= */
  if (phase === "setup") {
    return (
      <section className="card">
        <h2><span className="num">1</span> Chọn cách ôn — {title}</h2>
        <p className="muted sub">Bộ này có {questions ? questions.length : 0} câu{chapters ? " (lọc theo chương bên dưới)" : ""}.</p>
        {resume && (
          <div style={{ background: "var(--gold-l)", border: "1px solid var(--gold)", borderRadius: 12, padding: "12px 14px", margin: "0 0 14px" }}>
            <p style={{ margin: "0 0 8px" }}><b>⏸️ Bạn có bài đang làm dở</b> — đã làm {Object.keys(resume.answers || {}).length}/{resume.items.length} câu · lưu lúc {new Date(resume.savedAt || Date.now()).toLocaleTimeString("vi-VN")}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn primary" onClick={restoreSession}>▶ Tiếp tục làm bài</button>
              <button className="btn" onClick={() => { try { localStorage.removeItem(SKEY); } catch (e) {} setResume(null); }}>Xoá, làm đề mới</button>
            </div>
          </div>
        )}
        {chapters && (
          <div className="chapters">
            {chapters.map((c) => (
              <button type="button" key={c.key} className={chapter === c.key ? "active" : ""} onClick={() => setChapter(c.key)}>
                <b>{c.label}</b><small>{c.sub || ""}</small>
              </button>
            ))}
          </div>
        )}
        <div className="row">
          <label className="field">Số câu mỗi lần làm
            <select value={countSel} onChange={(e) => setCountSel(e.target.value)}>
              <option value="10">10 câu ngẫu nhiên</option>
              <option value="20">20 câu ngẫu nhiên</option>
              <option value="40">40 câu ngẫu nhiên</option>
              <option value="50">50 câu ngẫu nhiên</option>
              <option value="80">80 câu ngẫu nhiên</option>
              <option value="all">Tất cả</option>
            </select>
          </label>
          <label className="field">Cách học
            <select value={modeSel} onChange={(e) => setModeSel(e.target.value)}>
              <option value="study">Học: chọn xong hiện đúng/sai ngay</option>
              <option value="test">Thi: làm hết rồi nộp bài chấm điểm</option>
              <option value="single">Từng câu: chọn đúng mới qua câu sau</option>
            </select>
          </label>
        </div>
        <div className="checks">
          <label><input type="checkbox" checked={shuffleOpts} onChange={(e) => setShuffleOpts(e.target.checked)} /> Đảo đáp án A, B, C, D</label>
          <label><input type="checkbox" checked={shuffleQs} onChange={(e) => setShuffleQs(e.target.checked)} /> Đảo thứ tự câu hỏi</label>
        </div>
        <button className="btn primary wide" onClick={() => start()}>Bắt đầu làm bài →</button>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <button className="btn" onClick={() => start({ mock: true })}>⏱️ Thi thử 50 câu / 60 phút</button>
          <button className="btn" onClick={() => { setModeSel("single"); start({}); }}>Ôn từng câu →</button>
        </div>
        <p className="muted" style={{ margin: "12px 0 0", fontSize: 14 }}>Đang làm dở mà tải lại trang (F5) cũng không mất bài — web tự lưu phiên làm bài trên máy này.</p>
      </section>
    );
  }

  const singleActive = mode === "single" && phase === "quiz";
  const visibleIdx = singleActive ? [singleIdx] : items.map((_, i) => i);
  const answeredCount = mode === "single" ? singleIdx + (singleLastCorrect ? 1 : 0) : Object.keys(answers).length;
  const progressPct = items.length ? Math.round((phase === "result" ? items.length : answeredCount) / items.length * 100) : 0;

  return (
    <>
      <section className="card">
        <div className="quiz-head">
          <strong>{isMock ? "Thi thử · 50 câu · 60 phút" : title}</strong>
          <span>{isMock ? "Còn " + fmt(mockLeft) : fmt(elapsed)}</span>
        </div>
        <div className="progress"><div style={{ width: progressPct + "%" }} /></div>
        <div className="muted" style={{ marginBottom: 12 }}>{phase === "result" ? "Đã nộp bài" : "Đã làm " + answeredCount + "/" + items.length + " câu"}</div>

        {visibleIdx.map((qi) => {
          const q = items[qi];
          if (phase === "result" && showWrongOnly && (mode === "single" ? singleFirstPick[qi] === q.a : answers[qi] === q.a)) return null;
          const revealed = phase === "result" || (mode === "study" && answers[qi] !== undefined) || (singleActive && singleLastCorrect);
          const yourPick = mode === "single" ? singleFirstPick[qi] : answers[qi];
          return (
            <div className="q" key={qi}>
              <div className="tags">
                <span className="tag">{q.chapter && chapters ? "Chương " + q.chapter + " · " : ""}Câu {qi + 1}</span>
                {revealed && (phase === "result"
                  ? <span className={"tag " + (yourPick === q.a ? "ok" : "bad")}>{yourPick === q.a ? "✓ Đúng" : "✗ Sai"}</span>
                  : <span className={"tag " + (answers[qi] === q.a ? "ok" : "bad")}>{answers[qi] === q.a ? "✓ Đúng" : "✗ Sai"}</span>)}
              </div>
              <h3>{q.q}</h3>
              {q.imgs && q.imgs.length > 0 && (
                <div className="q-imgs">{q.imgs.map((src, ii) => <img key={ii} src={src} alt="Hình câu hỏi" loading="lazy" />)}</div>
              )}
              {q.opts.map((opt, oi) => {
                const cls = ["opt"];
                if (answers[qi] === oi) cls.push("selected");
                const wrongHere = singleActive && (singleWrong[qi] || []).includes(oi);
                if (wrongHere) cls.push("wrong");
                if (revealed) {
                  if (oi === q.a) cls.push("correct");
                  if (answers[qi] === oi && oi !== q.a) cls.push("wrong");
                }
                return (
                  <button type="button" key={oi} className={cls.join(" ")} disabled={revealed || wrongHere} onClick={() => pick(qi, oi)}>
                    <span className="l">{LETTERS[oi]}</span>
                    <span style={{ flex: 1 }}>{opt}
                      {q.optImgs && q.optImgs[oi] && q.optImgs[oi].length > 0 && (
                        <span className="opt-imgs">{q.optImgs[oi].map((src, ii) => <img key={ii} src={src} alt="Hình phương án" loading="lazy" />)}</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}

        {phase === "quiz" && (
          <div className="sticky">
            {mode !== "single" && <button className="btn primary" onClick={() => submit(false)}>{mode === "study" ? "Xem điểm" : "Nộp bài và chấm điểm"}</button>}
            <button className="btn" onClick={() => start({ mock: isMock })}>Xào đề mới</button>
            <button className="btn" onClick={() => setPhase("setup")}>Đổi cách ôn</button>
            {isMock && <span className="muted">Thi thử phải làm đủ {items.length} câu mới nộp được.</span>}
          </div>
        )}
      </section>

      {phase === "result" && (
        <section className="card">
          <h2>Kết quả của bạn</h2>
          <div className="score">{resultCorrect}/{items.length} · {items.length ? Math.round(resultCorrect / items.length * 100) : 0}%</div>
          <p style={{ margin: "8px 0" }}>{resultCorrect === items.length ? "🎉 Tuyệt đối! Bạn nắm chắc bộ này rồi." : resultCorrect / Math.max(items.length, 1) >= 0.8 ? "👏 Rất tốt — ôn lại mấy câu sai là chắc." : resultCorrect / Math.max(items.length, 1) >= 0.5 ? "Ổn — xem lại các câu sai bên dưới nhé." : "Đừng nản — làm lại các câu sai sẽ nhớ rất nhanh."}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn" onClick={() => setShowWrongOnly((v) => !v)}>{showWrongOnly ? "Xem tất cả" : "Chỉ xem câu sai"}</button>
            <button className="btn primary" onClick={() => setPhase("setup")}>Làm đề mới</button>
          </div>
          {wrongItems.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ margin: "0 0 8px" }}>❌ Câu sai cần ôn lại ({wrongItems.length})</h3>
              {wrongItems.map(({ q, i }) => (
                <div className="witem" key={i}>
                  <div className="muted" style={{ fontSize: 13.5 }}>Câu {i + 1}</div>
                  <div style={{ fontWeight: 600, margin: "2px 0 6px" }}>{q.q}</div>
                  <div className="wline you">Bạn chọn: {(mode === "single" ? singleFirstPick[i] : answers[i]) !== undefined ? LETTERS[mode === "single" ? singleFirstPick[i] : answers[i]] + ". " + q.opts[mode === "single" ? singleFirstPick[i] : answers[i]] : "— chưa chọn"}</div>
                  <div className="wline ok">Đáp án đúng: {LETTERS[q.a]}. {q.opts[q.a]}</div>
                </div>
              ))}
              <button className="btn primary" style={{ marginTop: 6 }} onClick={() => start({ src: wrongItems.map((w) => w.q) })}>🔁 Làm lại các câu sai</button>
            </div>
          )}
        </section>
      )}
    </>
  );
}
