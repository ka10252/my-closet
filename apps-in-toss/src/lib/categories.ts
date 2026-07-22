// 옷 카테고리 — 기본(코드) + 커스텀(DB) 을 합쳐서 사용

export interface EffectiveCategory {
  id: string; // 기본은 'top' 등 슬러그, 커스텀은 uuid
  label: string; // 한글 표시명
  emoji: string;
  builtin: boolean;
}

// 기본 제공 카테고리 (삭제 불가)
export const BUILTIN_CATEGORIES: EffectiveCategory[] = [
  { id: "top", label: "상의", emoji: "👕", builtin: true },
  { id: "bottom", label: "하의", emoji: "👖", builtin: true },
  { id: "activewear", label: "운동복", emoji: "🏃", builtin: true },
  { id: "outerwear", label: "아우터", emoji: "🧥", builtin: true },
  { id: "shoes", label: "신발", emoji: "👟", builtin: true },
  { id: "accessory", label: "악세서리", emoji: "🧢", builtin: true },
  { id: "other", label: "기타", emoji: "🧺", builtin: true },
];

// DB에서 온 커스텀 카테고리 레코드
export interface CategoryRow {
  id: string;
  user_id: string;
  label: string;
  emoji: string;
  created_at: string;
}

export function toEffective(row: CategoryRow): EffectiveCategory {
  return { id: row.id, label: row.label, emoji: row.emoji, builtin: false };
}

/** 기본 + 커스텀 합친 전체 카테고리 목록 */
export function mergeCategories(
  custom: EffectiveCategory[],
): EffectiveCategory[] {
  return [...BUILTIN_CATEGORIES, ...custom];
}

/** id로 라벨/이모지 찾기 (없으면 기타 취급) */
export function findCategory(
  id: string,
  all: EffectiveCategory[],
): EffectiveCategory {
  return (
    all.find((c) => c.id === id) ??
    BUILTIN_CATEGORIES[BUILTIN_CATEGORIES.length - 1]
  );
}

// 세부 카테고리 (예: 상의 → 반팔)
export interface Subcategory {
  id: string;
  user_id: string;
  parent: string; // 상위 카테고리 id
  label: string;
  created_at: string;
}

export interface Clothing {
  id: string;
  user_id: string;
  name: string | null;
  category: string;
  subcategory: string | null;
  image_url: string;
  cutout_url: string | null;
  color: string | null;
  season: string | null;
  notes: string | null;
  is_favorite: boolean;
  is_packed: boolean;
  scale: number;
  offset_y: number;
  board_x: number | null;
  board_y: number | null;
  created_at: string;
}
