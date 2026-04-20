"use client";

import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";

function SignInContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  const [tab, setTab] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (tab === "register") {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registration failed");
        setLoading(false);
        return;
      }
    }

    const result = await signIn("credentials", {
      email,
      password,
      callbackUrl,
      redirect: false,
    });

    setLoading(false);
    if (result?.error) {
      setError(tab === "register" ? "Account created but sign-in failed — try signing in." : "Invalid email or password");
    } else {
      router.push(callbackUrl);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-white">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 text-2xl font-bold" style={{ color: "var(--ink)", letterSpacing: "-0.25px" }}>MarkdownCollab</div>
          <p className="text-[15px]" style={{ color: "var(--ink-soft)" }}>Sign in to collaborate on documents</p>
        </div>

        <div
          className="rounded-xl bg-white p-8"
          style={{
            border: "1px solid var(--rule)",
            boxShadow:
              "rgba(0,0,0,0.04) 0 4px 18px, rgba(0,0,0,0.027) 0 2.025px 7.84688px, rgba(0,0,0,0.02) 0 0.8px 2.925px, rgba(0,0,0,0.01) 0 0.175px 1.04062px",
          }}
        >
          {/* Tab switcher */}
          <div
            className="mb-6 flex rounded p-1"
            style={{ background: "rgba(0,0,0,0.05)" }}
          >
            <button
              onClick={() => { setTab("signin"); setError(""); }}
              className="flex-1 rounded py-1.5 text-[15px] font-semibold transition-colors"
              style={
                tab === "signin"
                  ? { background: "#ffffff", color: "var(--ink)", boxShadow: "rgba(0,0,0,0.04) 0 1px 3px" }
                  : { background: "transparent", color: "var(--ink-soft)" }
              }
            >
              Sign in
            </button>
            <button
              onClick={() => { setTab("register"); setError(""); }}
              className="flex-1 rounded py-1.5 text-[15px] font-semibold transition-colors"
              style={
                tab === "register"
                  ? { background: "#ffffff", color: "var(--ink)", boxShadow: "rgba(0,0,0,0.04) 0 1px 3px" }
                  : { background: "transparent", color: "var(--ink-soft)" }
              }
            >
              Register
            </button>
          </div>

          {/* Email/password form */}
          <form onSubmit={handleCredentials} className="space-y-3">
            {tab === "register" && (
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded bg-white px-3 py-2.5 text-[15px] outline-none"
                style={{ border: "1px solid var(--input-border)", color: "var(--ink-2)" }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent-focus)";
                  e.currentTarget.style.boxShadow = "0 0 0 1px var(--accent-focus)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--input-border)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded bg-white px-3 py-2.5 text-[15px] outline-none"
              style={{ border: "1px solid var(--input-border)", color: "var(--ink-2)" }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--accent-focus)";
                e.currentTarget.style.boxShadow = "0 0 0 1px var(--accent-focus)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--input-border)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded bg-white px-3 py-2.5 text-[15px] outline-none"
              style={{ border: "1px solid var(--input-border)", color: "var(--ink-2)" }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--accent-focus)";
                e.currentTarget.style.boxShadow = "0 0 0 1px var(--accent-focus)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--input-border)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            {error && <p className="text-xs" style={{ color: "#dd5b00" }}>{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded py-2.5 text-[15px] font-semibold text-white transition-colors disabled:opacity-50"
              style={{ background: "var(--accent)" }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = "var(--accent-hover)"; }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = "var(--accent)"; }}
            >
              {loading ? "…" : tab === "register" ? "Create account" : "Sign in"}
            </button>
          </form>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1" style={{ background: "var(--rule)" }} />
            <span className="text-xs" style={{ color: "var(--ink-muted)" }}>or</span>
            <div className="h-px flex-1" style={{ background: "var(--rule)" }} />
          </div>

          {/* Google */}
          <button
            onClick={() => signIn("google", { callbackUrl })}
            className="flex w-full items-center justify-center gap-3 rounded bg-white px-4 py-2.5 text-[15px] font-semibold transition-colors"
            style={{ border: "1px solid var(--input-border)", color: "var(--ink)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#ffffff"; }}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>
        </div>

        <p className="mt-6 text-center text-xs" style={{ color: "var(--ink-muted)" }}>
          Or{" "}
          <a href={callbackUrl} className="hover:underline" style={{ color: "var(--accent)" }}>
            continue as guest
          </a>
        </p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInContent />
    </Suspense>
  );
}
