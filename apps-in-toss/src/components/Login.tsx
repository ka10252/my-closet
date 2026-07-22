import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const INK = "#2A1206";

// 앱인토스 웹뷰용 로그인 — 이메일 + 비밀번호.
// (매직링크/OTP는 웹뷰·무료플랜에서 불편하므로 비밀번호 방식 사용)
export default function Login() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const addr = email.trim();
    const pw = password;
    if (!addr || !pw) return;
    if (mode === "signup" && pw.length < 6) {
      setError("비밀번호는 6자 이상으로 정해주세요.");
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    const supabase = createClient();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email: addr,
        password: pw,
      });
      setLoading(false);
      if (error) {
        setError("이메일 또는 비밀번호가 올바르지 않아요.");
        return;
      }
      // 성공 시 App 의 onAuthStateChange 가 옷장으로 전환
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: addr,
        password: pw,
      });
      setLoading(false);
      if (error) {
        setError(
          error.message.includes("already")
            ? "이미 가입된 이메일이에요. 로그인해 주세요."
            : "가입에 실패했어요. 잠시 후 다시 시도해 주세요.",
        );
        return;
      }
      if (data.session) {
        // 이메일 확인이 꺼져 있으면 바로 로그인됨 (onAuthStateChange 처리)
        return;
      }
      // 이메일 확인이 켜져 있는 경우
      setNotice(
        "가입 확인 메일을 보냈어요. 메일함에서 확인 링크를 누른 뒤, 이 화면에서 로그인해 주세요.",
      );
      setMode("signin");
    }
  }

  async function sendReset() {
    const addr = email.trim();
    if (!addr) {
      setError("이메일 주소를 먼저 입력해 주세요.");
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    const { error } = await createClient().auth.resetPasswordForEmail(addr, {
      redirectTo: window.location.origin,
    });
    setLoading(false);
    if (error) {
      setError("메일 전송에 실패했어요. 이메일 주소를 확인해 주세요.");
      return;
    }
    setNotice(
      "비밀번호 설정 메일을 보냈어요. 메일의 링크를 눌러 새 비밀번호를 정한 뒤 로그인해 주세요.",
    );
  }

  const isSignup = mode === "signup";

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

      <form onSubmit={submit} className="w-full max-w-xs space-y-3">
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일 주소"
          className="w-full rounded-2xl border-2 bg-white px-4 py-3.5 text-sm outline-none"
          style={{ borderColor: INK, color: INK }}
        />
        <input
          type="password"
          required
          autoComplete={isSignup ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={isSignup ? "비밀번호 (6자 이상)" : "비밀번호"}
          className="w-full rounded-2xl border-2 bg-white px-4 py-3.5 text-sm outline-none"
          style={{ borderColor: INK, color: INK }}
        />
        {error && (
          <p className="text-xs font-medium" style={{ color: "#FFE3D6" }}>
            {error}
          </p>
        )}
        {notice && (
          <p className="text-xs font-medium text-white">{notice}</p>
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
          {loading
            ? "잠시만요…"
            : isSignup
              ? "회원가입"
              : "로그인"}
        </button>
        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setMode(isSignup ? "signin" : "signup");
              setError("");
              setNotice("");
            }}
            className="text-xs underline"
            style={{ color: "#FFE3D6" }}
          >
            {isSignup
              ? "이미 계정이 있으신가요? 로그인"
              : "처음이신가요? 회원가입"}
          </button>
          {!isSignup && (
            <button
              type="button"
              onClick={sendReset}
              disabled={loading}
              className="text-[11px] underline"
              style={{ color: "#FFD8C6" }}
            >
              비밀번호를 잊으셨거나 처음이신가요? 비밀번호 설정
            </button>
          )}
        </div>
      </form>
    </main>
  );
}
