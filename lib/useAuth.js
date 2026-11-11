"use client";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";

export function useAuth() {
  const [user, setUser] = useState(undefined); // undefined = dang tai, null = chua dang nhap
  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u || null)), []);
  return user;
}
