"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait for auth to be ready (persistence may need to initialize)
    let unsubscribe: (() => void) | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const init = async () => {
      // Auth may need a tick to restore from localStorage
      await auth.authStateReady?.().catch(() => {});

      unsubscribe = onAuthStateChanged(auth, (u) => {
        setUser(u);
        setLoading(false);
        if (timeout) clearTimeout(timeout);
      }, (error) => {
        console.error("Firebase auth error:", error);
        setLoading(false);
      });

      // Safety timeout — 15s is generous enough for slow networks
      timeout = setTimeout(() => {
        setLoading((current) => {
          if (current) {
            console.warn("Firebase auth timed out, redirecting to login");
            return false;
          }
          return current;
        });
      }, 15000);
    };

    init();

    return () => {
      unsubscribe?.();
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  return { user, loading };
}
