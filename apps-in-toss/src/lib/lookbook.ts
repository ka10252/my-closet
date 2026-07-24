import { createClient } from "@/lib/supabase/client";

// 저장한 코디(룩북) — 옷 id 배열로 구성 보관
export interface Lookbook {
  id: string;
  user_id: string;
  name: string;
  item_ids: string[];
  created_at: string;
}

export async function fetchLookbooks(): Promise<Lookbook[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("lookbooks")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Lookbook[];
}

export async function addLookbook(
  name: string,
  itemIds: string[],
): Promise<Lookbook> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다");
  const { data, error } = await supabase
    .from("lookbooks")
    .insert({
      user_id: user.id,
      name: name.trim() || "내 코디",
      item_ids: itemIds,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Lookbook;
}

export async function deleteLookbook(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("lookbooks").delete().eq("id", id);
  if (error) throw error;
}
