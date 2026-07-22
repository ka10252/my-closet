import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

// 앱인토스 웹뷰용 Supabase 클라이언트.
// iOS 웹뷰는 서드파티 쿠키를 막으므로 쿠키 세션 대신 localStorage 토큰 기반으로 동작.
// (세션은 localStorage에 저장되고 자동 갱신됨. 매직링크 URL 감지는 사용 안 함)
let client: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (client) return client;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "Supabase 환경변수가 없어요. apps-in-toss/.env.local 에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 를 넣어주세요.",
    );
  }

  client = createSupabaseClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // 비밀번호 설정(재설정) 링크로 돌아올 때 URL 토큰을 감지해야 함
      detectSessionInUrl: true,
    },
  });
  return client;
}
