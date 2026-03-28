"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Sparkles } from "lucide-react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";

function friendlyError(code: string): string {
  switch (code) {
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Invalid email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.push("/");
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      setError(friendlyError(code));
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      if (code !== "auth/popup-closed-by-user") {
        setError(friendlyError(code));
      }
    }
  };

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#FAFAFA]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="size-6 rounded-full border-2 border-neutral-200 border-t-neutral-400"
        />
      </div>
    );
  }

  return (
    <div className="flex h-dvh items-center justify-center bg-[#FAFAFA] px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm space-y-8"
      >
        <div className="space-y-3 text-center">
          <h1 className="text-3xl font-light tracking-tight text-neutral-900">
            Mneme
          </h1>
          <p className="text-neutral-500 font-light">
            {isSignUp ? "Create your account" : "Sign in to continue"}
          </p>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-500"
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            autoComplete="email"
            className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-light shadow-sm transition-all placeholder:text-neutral-300 focus:border-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-100"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            autoComplete={isSignUp ? "new-password" : "current-password"}
            className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-light shadow-sm transition-all placeholder:text-neutral-300 focus:border-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-100"
          />
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition-all hover:bg-neutral-800 hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
          >
            {submitting
              ? isSignUp ? "Creating account..." : "Signing in..."
              : isSignUp ? "Sign Up" : "Sign In"}
            <Sparkles size={14} />
          </button>
        </form>

        <div className="flex items-center gap-4 text-xs text-neutral-300">
          <div className="h-px flex-1 bg-neutral-200" />
          <span>or</span>
          <div className="h-px flex-1 bg-neutral-200" />
        </div>

        <button
          onClick={handleGoogle}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-6 py-3 text-sm font-light text-neutral-600 shadow-sm transition-all hover:border-neutral-300 hover:shadow-md active:scale-[0.98]"
        >
          Sign in with Google
        </button>

        <p className="text-center text-sm font-light text-neutral-400">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
            }}
            className="font-medium text-neutral-900 hover:underline"
          >
            {isSignUp ? "Sign In" : "Sign Up"}
          </button>
        </p>
      </motion.div>
    </div>
  );
}
