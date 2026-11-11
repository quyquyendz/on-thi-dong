import { collection, addDoc, getDocs, doc, getDoc, setDoc, deleteDoc, query, where, orderBy, limit, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export async function listBanks(uid) {
  const snap = await getDocs(query(collection(db, "banks"), where("owner", "==", uid)));
  const out = [];
  snap.forEach((d) => {
    const v = d.data();
    out.push({ id: d.id, name: v.name || "Bộ đề", count: v.count || (v.questions ? v.questions.length : 0), createdAt: v.createdAt && v.createdAt.toMillis ? v.createdAt.toMillis() : 0 });
  });
  out.sort((a, b) => b.createdAt - a.createdAt);
  return out;
}

export async function loadBank(id) {
  const snap = await getDoc(doc(db, "banks", id));
  if (!snap.exists()) return null;
  const v = snap.data();
  return { id, name: v.name || "Bộ đề", questions: v.questions || [], owner: v.owner || "", shared: !!v.shared };
}

export async function saveBank(uid, name, questions) {
  const ref = await addDoc(collection(db, "banks"), { owner: uid, name, count: questions.length, questions, shared: false, createdAt: serverTimestamp() });
  return ref.id;
}

export async function setBankShared(id, shared) {
  const { updateDoc } = await import("firebase/firestore");
  await updateDoc(doc(db, "banks", id), { shared: !!shared });
}

export async function deleteBank(id) {
  await deleteDoc(doc(db, "banks", id));
}

export async function saveResult(uid, displayName, scoreText, title) {
  const m = String(scoreText).match(/^(\d+)\/(\d+)/);
  const pct = m && +m[2] ? Math.round((+m[1] / +m[2]) * 100) : null;
  await addDoc(collection(db, "users", uid, "results"), {
    score: scoreText,
    title: title || "Đề luyện thi",
    date: new Date().toLocaleString("vi-VN"),
    at: serverTimestamp(),
  });
  if (pct !== null) {
    const lbRef = doc(db, "leaderboard", uid);
    const cur = await getDoc(lbRef);
    if (!cur.exists() || pct > (cur.data().pct || 0)) {
      await setDoc(lbRef, { name: displayName || "Người dùng", pct, score: scoreText, at: serverTimestamp() });
    }
  }
}

export async function listResults(uid) {
  const snap = await getDocs(query(collection(db, "users", uid, "results"), orderBy("at", "desc"), limit(50)));
  const out = [];
  snap.forEach((d) => { const v = d.data(); out.push({ score: v.score || "", title: v.title || "", date: v.date || "" }); });
  return out;
}

export async function getLeaderboard() {
  const snap = await getDocs(collection(db, "leaderboard"));
  const out = [];
  snap.forEach((d) => { const v = d.data(); out.push({ uid: d.id, name: v.name || "Người dùng", pct: v.pct || 0, score: v.score || "" }); });
  out.sort((a, b) => b.pct - a.pct);
  return out.slice(0, 10);
}
