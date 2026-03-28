"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onAuthStateChanged fires immediately with cached user or null
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    }, () => {
      setLoading(false);
    });

    // Safety timeout — 3s max wait
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 3000);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  return { user, loading };
}
