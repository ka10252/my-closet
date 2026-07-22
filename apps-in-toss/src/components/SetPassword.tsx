import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const INK = "#2A1206";

// 비밀번호 설정 링크로 들어왔을 때(PASSWORD_RECOVERY) 새 비밀번호를 정하는 화면.
export default function SetPassword({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 6) {
      setError("비밀번호는 6자 이상으로 정해주세요.");
      return;
    }
    if (pw !== pw2) {
      setError("두 비밀번호가 서로 달라요.");
      return;
    }
    setLoading(true);
    setError("");
    const { error } = await createClient().auth.updateUser({ password: pw });
    setLoading(false);
    if (error) {
      setError("설정에 실패했어요. 링크가 만료됐다면 다시 요청해 주세요.");
      return;
    }
    onDone();
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
      <div className="space-y-2">
        <h1
          className="font-display text-4xl text-white"
          style={{ textShadow: `4px 4px 0 ${INK}` }}
        >
          비밀번호 설정
        </h1>
        <p
          className="text-xs font-semibold uppercase"
          style={{ color: "#FFE3D6", letterSpacing: ".14em" }}
        >
          새 비밀번호를 정해주세요
        </p>
      </div>

      <form onSubmit={submit} className="w-full max-w-xs space-y-3">
        <input
          type="password"
          required
          autoComplete="new-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="새 비밀번호 (6자 이상)"
          className="w-full rounded-2xl border-2 bg-white px-4 py-3.5 text-sm outline-none"
          style={{ borderColor: INK, color: INK }}
        />
        <input
          type="password"
          required
          autoComplete="new-password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          placeholder="새 비밀번호 다시 입력"
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
          {loading ? "설정 중…" : "비밀번호 저장하고 시작하기"}
        </button>
      </form>
    </main>
  );
}
