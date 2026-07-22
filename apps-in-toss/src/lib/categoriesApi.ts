import { createClient } from "@/lib/supabase/client";
import {
  toEffective,
  type CategoryRow,
  type EffectiveCategory,
  type Subcategory,
} from "@/lib/categories";

/** 내 커스텀 카테고리 목록 */
export async function fetchCustomCategories(): Promise<EffectiveCategory[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as CategoryRow[]).map(toEffective);
}

export async function addCustomCategory(
  label: string,
  emoji: string,
): Promise<EffectiveCategory> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다");

  const { data, error } = await supabase
    .from("categories")
    .insert({ user_id: user.id, label: label.trim(), emoji: emoji || "🏷️" })
    .select("*")
    .single();
  if (error) throw error;
  return toEffective(data as CategoryRow);
}

export async function deleteCustomCategory(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw error;
}

export async function updateCustomCategory(
  id: string,
  patch: { label?: string; emoji?: string },
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("categories").update(patch).eq("id", id);
  if (error) throw error;
}

// ---- 세부 카테고리 ----

export async function fetchSubcategories(): Promise<Subcategory[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("subcategories")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Subcategory[];
}

export async function addSubcategory(
  parent: string,
  label: string,
): Promise<Subcategory> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다");
  const { data, error } = await supabase
    .from("subcategories")
    .insert({ user_id: user.id, parent, label: label.trim() })
    .select("*")
    .single();
  if (error) throw error;
  return data as Subcategory;
}

export async function deleteSubcategory(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("subcategories").delete().eq("id", id);
  if (error) throw error;
}

export async function updateSubcategory(
  id: string,
  label: string,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("subcategories")
    .update({ label: label.trim() })
    .eq("id", id);
  if (error) throw error;
}
