"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const INK = "#2A1206";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) {
      setError("메일 전송에 실패했어요. 이메일 주소를 확인해 주세요.");
      return;
    }
    setSent(true);
  }

  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 text-center"
      style={{
        background: "#FF6A3D",
        backgroundImage:
          "radial-gradient(rgba(255,255,255,.16) 1.8px, transparent 1.8px)",
        backgroundSize: "22px 22px",
      }}
    >
      <div className="space-y-3">
        <h1
          className="font-display text-5xl text-white"
          style={{ textShadow: `4px 4px 0 ${INK}` }}
        >
          CLOSET
        </h1>
        <p
          className="text-xs font-semibold uppercase leading-relaxed"
          style={{ color: "#FFE3D6", letterSpacing: ".2em" }}
        >
          내 옷을 스티커처럼
          <br />
          모아두는 옷장
        </p>
      </div>

      {sent ? (
        <div className="max-w-xs space-y-3">
          <div className="text-4xl">📬</div>
          <p className="text-sm font-medium text-white">
            <b>{email}</b> 로 로그인 링크를 보냈어요.
            <br />
            메일함에서 링크를 누르면 바로 로그인돼요.
          </p>
          <button
            onClick={() => setSent(false)}
            className="text-xs underline"
            style={{ color: "#FFE3D6" }}
          >
            다른 이메일로 다시 보내기
          </button>
        </div>
      ) : (
        <form onSubmit={sendLink} className="w-full max-w-xs space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일 주소"
            className="w-full rounded-2xl border-2 bg-white px-4 py-3.5 text-sm outline-none"
            style={{ borderColor: INK, color: INK }}
          />
          {error && (
            <p className="text-xs font-medium" style={{ color: "#FFE3D6" }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="font-kr w-full rounded-2xl border-2 py-3.5 text-base font-bold text-white transition active:scale-[.97] disabled:opacity-60"
            style={{
              background: INK,
              borderColor: INK,
              boxShadow: "0 12px 26px -8px rgba(0,0,0,.3)",
            }}
          >
            {loading ? "보내는 중…" : "로그인 링크 받기"}
          </button>
          <p
            className="text-[11px] font-semibold uppercase"
            style={{ color: "#FFD8C6", letterSpacing: ".08em" }}
          >
            비밀번호 없이 메일 링크로 로그인해요
          </p>
        </form>
      )}
    </main>
  );
}
