import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import Closet from "@/components/Closet";
import Login from "@/components/Login";
import SetPassword from "@/components/SetPassword";
import Onboarding, { ONBOARD_KEY } from "@/components/Onboarding";

function isOnboarded() {
  try {
    return localStorage.getItem(ONBOARD_KEY) === "1";
  } catch {
    return true; // localStorage 불가 시 온보딩 생략
  }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(isOnboarded);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      // 비밀번호 설정 링크로 들어오면 새 비밀번호 화면을 띄움
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (!ready) {
    return (
      <main
        style={{
          display: "flex",
          height: "100dvh",
          alignItems: "center",
          justifyContent: "center",
          color: "#B0846A",
        }}
      >
        불러오는 중…
      </main>
    );
  }

  if (recovering)
    return <SetPassword onDone={() => setRecovering(false)} />;

  if (!session) return <Login />;

  return (
    <>
      <Closet
        onReplayTour={() => {
          try {
            localStorage.removeItem(ONBOARD_KEY);
          } catch {
            // 무시
          }
          setOnboarded(false);
        }}
      />
      {!onboarded && <Onboarding onDone={() => setOnboarded(true)} />}
    </>
  );
}
