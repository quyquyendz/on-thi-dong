"use client";
import { useState } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useAuth } from "../lib/useAuth";

const ERR = {
  "auth/invalid-email": "Email chưa đúng định dạng.",
  "auth/missing-password": "Hãy nhập mật khẩu.",
  "auth/weak-password": "Mật khẩu quá yếu — cần ít nhất 6 ký tự.",
  "auth/email-already-in-use": "Email này đã đăng ký rồi. Hãy bấm Đăng nhập.",
  "auth/invalid-credential": "Sai email hoặc mật khẩu.",
  "auth/user-not-found": "Không tìm thấy tài khoản với email này.",
  "auth/wrong-password": "Sai mật khẩu.",
  "auth/too-many-requests": "Thử sai quá nhiều lần — đợi ít phút rồi thử lại.",
  "auth/network-request-failed": "Lỗi mạng — kiểm tra kết nối rồi thử lại.",
  "auth/popup-closed-by-user": "Cửa sổ Google đã đóng trước khi đăng nhập xong.",
  "auth/operation-not-allowed": "Cách đăng nhập này chưa bật trong Firebase.",
};

export default function AuthBox() {
  const user = useAuth();
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  if (user === undefined) return <section className="card"><p className="muted">Đang kiểm tra đăng nhập…</p></section>;
  if (user) {
    return (
      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div>👋 Xin chào, <b>{user.displayName || (user.email || "").split("@")[0]}</b><div className="muted" style={{ fontSize: 14 }}>Tài khoản: {user.email} · Bộ đề và lịch sử đồng bộ theo tài khoản này.</div></div>
          <button className="btn" onClick={() => signOut(auth)}>Đăng xuất</button>
        </div>
      </section>
    );
  }

  async function submit(e) {
    e.preventDefault();
    setErr(""); setOk(""); setBusy(true);
    try {
      if (mode === "register") {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
        if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), pass);
      }
    } catch (ex) { setErr(ERR[ex.code] || ("Đã có lỗi: " + ex.code)); }
    setBusy(false);
  }
  async function google() {
    setErr(""); setBusy(true);
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch (ex) { setErr(ERR[ex.code] || ("Đã có lỗi: " + ex.code)); }
    setBusy(false);
  }
  async function forgot() {
    if (!email.trim()) { setErr("Nhập email của bạn trước, rồi bấm Quên mật khẩu."); return; }
    setErr(""); setBusy(true);
    try { await sendPasswordResetEmail(auth, email.trim()); setOk("Đã gửi email đặt lại mật khẩu — kiểm tra hộp thư (cả mục Spam)."); }
    catch (ex) { setErr(ERR[ex.code] || ("Đã có lỗi: " + ex.code)); }
    setBusy(false);
  }

  return (
    <section className="card">
      <h2>🔐 Đăng nhập để ôn thi</h2>
      <p className="muted sub">Dùng chung tài khoản với bản web cũ — bộ đề đã lưu và lịch sử làm bài vẫn còn nguyên.</p>
      <div className="auth-tabs">
        <button type="button" className={"btn" + (mode === "login" ? " active" : "")} onClick={() => setMode("login")}>Đăng nhập</button>
        <button type="button" className={"btn" + (mode === "register" ? " active" : "")} onClick={() => setMode("register")}>Đăng ký</button>
      </div>
      <form onSubmit={submit}>
        {mode === "register" && (
          <label className="field">Tên hiển thị
            <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Nguyen" autoComplete="name" />
          </label>
        )}
        <label className="field">Email
          <input className="field-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ban@vidu.com" autoComplete="email" required />
        </label>
        <label className="field">Mật khẩu
          <input className="field-input" type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Ít nhất 6 ký tự" autoComplete={mode === "register" ? "new-password" : "current-password"} required />
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
          <button className="btn primary" type="submit" disabled={busy}>{mode === "register" ? "Đăng ký và vào ôn →" : "Đăng nhập →"}</button>
          <button className="btn" type="button" onClick={google} disabled={busy}>Đăng nhập bằng Google</button>
          <button className="btn" type="button" onClick={forgot} disabled={busy}>Quên mật khẩu</button>
        </div>
        {err && <p className="auth-err">{err}</p>}
        {ok && <p className="auth-ok">{ok}</p>}
      </form>
    </section>
  );
}
