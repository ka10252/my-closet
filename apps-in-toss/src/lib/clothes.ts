import { createClient } from "@/lib/supabase/client";
import type { Clothing } from "@/lib/categories";

const BUCKET = "clothes";

export async function fetchClothes(): Promise<Clothing[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("clothes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Clothing[];
}

export interface NewClothing {
  sticker: Blob; // 흰 테두리 스티커 PNG (표시용)
  cutout: Blob; // 테두리 없는 컷아웃 (편집 원본)
  category: string;
  name?: string;
}

async function uploadPng(userId: string, blob: Blob): Promise<string> {
  const supabase = createClient();
  const path = `${userId}/${crypto.randomUUID()}.png`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: "image/png", upsert: false });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function storagePath(url: string): string | null {
  const marker = `/${BUCKET}/`;
  const idx = url.indexOf(marker);
  return idx === -1 ? null : url.slice(idx + marker.length);
}

export async function addClothing(input: NewClothing): Promise<Clothing> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다");

  // 파일 1개만 업로드(테두리는 표시할 때 CSS로 그림) → 업로드 절반
  const url = await uploadPng(user.id, input.cutout);

  const { data, error } = await supabase
    .from("clothes")
    .insert({
      user_id: user.id,
      category: input.category,
      name: input.name?.trim() || null,
      image_url: url,
      cutout_url: url,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Clothing;
}

/** 기존 옷의 누끼 이미지를 새 것으로 교체 (편집/사진 교체) */
export async function replaceImage(
  item: Clothing,
  next: { sticker: Blob; cutout: Blob },
): Promise<Clothing> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다");

  const url = await uploadPng(user.id, next.cutout);

  const { data, error } = await supabase
    .from("clothes")
    .update({ image_url: url, cutout_url: url })
    .eq("id", item.id)
    .select("*")
    .single();
  if (error) throw error;

  // 이전 파일 정리 (중복 제거)
  const oldPaths = Array.from(
    new Set(
      [item.image_url, item.cutout_url]
        .filter((u): u is string => !!u)
        .map(storagePath)
        .filter((p): p is string => !!p),
    ),
  );
  if (oldPaths.length) {
    await supabase.storage.from(BUCKET).remove(oldPaths);
  }
  return data as Clothing;
}

export async function deleteClothing(item: Clothing): Promise<void> {
  const supabase = createClient();
  const paths = [item.image_url, item.cutout_url]
    .filter((u): u is string => !!u)
    .map(storagePath)
    .filter((p): p is string => !!p);
  if (paths.length) {
    await supabase.storage.from(BUCKET).remove(paths);
  }
  const { error } = await supabase.from("clothes").delete().eq("id", item.id);
  if (error) throw error;
}

export async function updateClothing(
  id: string,
  patch: Partial<
    Pick<
      Clothing,
      | "name"
      | "category"
      | "subcategory"
      | "is_favorite"
      | "is_packed"
      | "scale"
      | "offset_y"
      | "board_x"
      | "board_y"
    >
  >,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("clothes").update(patch).eq("id", id);
  if (error) throw error;
}

/** 특정 카테고리에 속한 옷들을 '기타'로 이동 (커스텀 카테고리 삭제 시) */
export async function reassignCategory(
  fromCategory: string,
  toCategory = "other",
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("clothes")
    .update({ category: toCategory })
    .eq("category", fromCategory);
  if (error) throw error;
}

/** 모든 옷의 패킹 체크 해제 (다음 여행 준비 시 초기화) */
export async function resetAllPacked(): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("clothes")
    .update({ is_packed: false })
    .eq("is_packed", true);
  if (error) throw error;
}
