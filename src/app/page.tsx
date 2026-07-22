import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Closet from "@/components/Closet";

export default async function Home() {
  // 환경변수 미설정 시 안내 (아직 Supabase 키를 안 넣었을 때)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return (
      <main className="mx-auto max-w-md px-6 py-20 text-center text-sm text-neutral-500">
        <div className="mb-3 text-4xl">🔧</div>
        <p className="mb-2 font-medium text-neutral-800 dark:text-neutral-200">
          Supabase 설정이 필요해요
        </p>
        <p>
          <code>.env.local</code> 에 Supabase URL / anon key 를 넣고{" "}
          <code>supabase/schema.sql</code> 을 실행한 뒤 새로고침해 주세요.
        </p>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <Closet />;
}
