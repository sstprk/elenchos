"use client";

import { useState } from "react";

interface AuthModalProps {
  onSuccess: (user: { id: string; email: string }) => void;
  onClose: () => void;
}

export default function AuthModal({ onSuccess, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const endpoint = mode === "signin" ? "/api/auth/signin" : "/api/auth/signup";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      if (mode === "signup" && data.message) {
        setMessage(data.message);
        return;
      }

      if (data.user) {
        onSuccess(data.user);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] p-6 shadow-2xl animate-fade-in">
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-semibold text-[var(--text)]">
              {mode === "signin" ? "Sign In" : "Create Account"}
            </h2>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-dim)] hover:bg-[var(--bg-warm)] hover:text-[var(--text)] transition-colors"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-[var(--text-dim)] mb-1 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] focus:border-[var(--accent-dim)] focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--text-dim)] mb-1 block">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] focus:border-[var(--accent-dim)] focus:outline-none transition-colors"
              />
            </div>

            {error && (
              <p className="text-sm text-[var(--red)] italic">{error}</p>
            )}
            {message && (
              <p className="text-sm text-[var(--green)] italic">{message}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
            >
              {loading ? "..." : mode === "signin" ? "Sign In" : "Sign Up"}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
                setMessage(null);
              }}
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              {mode === "signin"
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
