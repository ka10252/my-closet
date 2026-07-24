import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import Closet from "@/components/Closet";
import Login from "@/components/Login";
import SetPassword from "@/components/SetPassword";
import Onboarding, { ONBOARD_KEY } from "@/components/Onboarding";

// 이 기기에서 이미 온보딩을 봤는지 (계정 metadata 를 못 읽는 경우의 빠른 스킵)
function localOnboarded() {
  try {
    return localStorage.getItem(ONBOARD_KEY) === "1";
  } catch {
    return false;
  }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [forceTour, setForceTour] = useState(false); // '다시 보기'로 강제 표시
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

  // 온보딩은 가입 후 첫 로그인 시에만 (계정 metadata 기준, 이 기기 로컬 기록도 스킵 근거)
  const seen = session.user.user_metadata?.onboarded === true || localOnboarded();
  const showTour = forceTour || !seen;

  async function finishTour() {
    setForceTour(false);
    try {
      localStorage.setItem(ONBOARD_KEY, "1");
    } catch {
      // 무시
    }
    try {
      await createClient().auth.updateUser({ data: { onboarded: true } });
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <>
      <Closet onReplayTour={() => setForceTour(true)} />
      {showTour && <Onboarding onDone={finishTour} />}
    </>
  );
}
