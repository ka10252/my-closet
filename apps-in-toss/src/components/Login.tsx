import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const INK = "#2A1206";

// 앱인토스 웹뷰용 로그인 — 이메일로 6자리 인증코드를 받아 입력.
// (매직링크 리다이렉트는 웹뷰에서 불안정하므로 OTP 코드 방식 사용)
export default function Login() {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    const addr = email.trim();
    if (!addr) return;
    setLoading(true);
    setError("");
    const { error } = await createClient().auth.signInWithOtp({
      email: addr,
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (error) {
      setError("메일 전송에 실패했어요. 이메일 주소를 확인해 주세요.");
      return;
    }
    setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    const token = code.trim();
    if (!token) return;
    setLoading(true);
    setError("");
    const { error } = await createClient().auth.verifyOtp({
      email: email.trim(),
      token,
      type: "email",
    });
    setLoading(false);
    if (error) {
      setError("코드가 올바르지 않거나 만료됐어요. 다시 확인해 주세요.");
      return;
    }
    // 성공 시 App 의 onAuthStateChange 가 화면을 옷장으로 전환
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

      {step === "email" ? (
        <form onSubmit={sendCode} className="w-full max-w-xs space-y-3">
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
            {loading ? "보내는 중…" : "인증코드 받기"}
          </button>
          <p
            className="text-[11px] font-semibold uppercase"
            style={{ color: "#FFD8C6", letterSpacing: ".08em" }}
          >
            비밀번호 없이 이메일 코드로 로그인해요
          </p>
        </form>
      ) : (
        <form onSubmit={verify} className="w-full max-w-xs space-y-3">
          <p className="text-sm font-medium text-white">
            <b>{email}</b> 로 보낸
            <br />
            6자리 코드를 입력해 주세요.
          </p>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="인증코드 6자리"
            className="w-full rounded-2xl border-2 bg-white px-4 py-3.5 text-center text-lg font-bold tracking-[.3em] outline-none"
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
            {loading ? "확인 중…" : "로그인"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setError("");
            }}
            className="text-xs underline"
            style={{ color: "#FFE3D6" }}
          >
            다른 이메일로 다시 받기
          </button>
        </form>
      )}
    </main>
  );
}
