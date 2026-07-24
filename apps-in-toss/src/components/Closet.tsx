"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchClothes,
  deleteClothing,
  updateClothing,
  resetAllPacked,
  replaceImage,
} from "@/lib/clothes";
import {
  fetchCustomCategories,
  addCustomCategory,
  deleteCustomCategory,
  updateCustomCategory,
  fetchSubcategories,
  addSubcategory,
  deleteSubcategory,
  updateSubcategory,
} from "@/lib/categoriesApi";
import {
  mergeCategories,
  findCategory,
  SEASONS,
  type EffectiveCategory,
  type Subcategory,
  type Clothing,
} from "@/lib/categories";
import AddSheet from "@/components/AddSheet";
import CategorySheet from "@/components/CategorySheet";
import ImageEditor from "@/components/ImageEditor";
import CoordiSheet from "@/components/CoordiSheet";

const TANGERINE = "#FF6A3D";
const INK = "#2A1206";
const MUTED = "#B0846A";
const LINE = "#F3C9B4";

const HIDDEN_CATS_KEY = "mycloset_hidden_cats";

type Filter = "all" | "favorite" | string;

interface ConfirmOpts {
  title: string;
  message?: string;
  confirmText?: string;
  danger?: boolean;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function displaySrc(item: Clothing) {
  return item.cutout_url ?? item.image_url;
}

// 아이템 id로부터 결정적 난수(매 렌더 동일 위치) — 무작위 스캐터용
function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rngFrom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function Closet({
  onReplayTour,
}: {
  onReplayTour: () => void;
}) {
  const [items, setItems] = useState<Clothing[]>([]);
  const [custom, setCustom] = useState<EffectiveCategory[]>([]);
  const [subcats, setSubcats] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [subFilter, setSubFilter] = useState<string>("all");
  const [seasonFilter, setSeasonFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [packing, setPacking] = useState(false);
  const [unpackedOnly, setUnpackedOnly] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<
    (ConfirmOpts & { resolve: (v: boolean) => void }) | null
  >(null);
  const [toast, setToast] = useState<{
    msg: string;
    onRetry?: () => void;
  } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [hidden, setHidden] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(HIDDEN_CATS_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const [addOpen, setAddOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [coordiOpen, setCoordiOpen] = useState(false);
  const [selected, setSelected] = useState<Clothing | null>(null);
  const [editTarget, setEditTarget] = useState<Clothing | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  // 시트를 history에 쌓아 폰 '뒤로가기'로 이전 화면으로 닫히게 함
  const sheetStack = useRef<Array<() => void>>([]);
  useEffect(() => {
    const onPop = () => {
      const close = sheetStack.current.pop();
      if (close) close();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  function openSheet(close: () => void) {
    sheetStack.current.push(close);
    window.history.pushState({ closetSheet: sheetStack.current.length }, "");
  }
  function closeTop() {
    if (sheetStack.current.length) window.history.back();
  }

  function openItem(item: Clothing) {
    openSheet(() => setSelected(null));
    setSelected(item);
  }

  async function handleMovePosition(item: Clothing, x: number, y: number) {
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, board_x: x, board_y: y } : i)),
    );
    await persist(
      () => updateClothing(item.id, { board_x: x, board_y: y }),
      "위치를 저장하지 못했어요",
    );
  }

  // 전체(숨김 포함) — 카테고리 편집 화면용. categories = 화면에 보이는 것(숨김 제외)
  const allCategories = useMemo(() => mergeCategories(custom), [custom]);
  const categories = useMemo(
    () => allCategories.filter((c) => !hidden.includes(c.id)),
    [allCategories, hidden],
  );

  async function reload() {
    setLoadError(false);
    try {
      // 로그인 직후엔 세션 토큰이 아직 전파되지 않아 빈 목록이 올 수 있어서,
      // 세션이 확실히 준비된 뒤 불러온다 (그래야 새로고침 없이 바로 뜸)
      await createClient().auth.getSession();
      const [cl, cats, subs] = await Promise.all([
        fetchClothes(),
        fetchCustomCategories(),
        fetchSubcategories(),
      ]);
      setItems(cl);
      setCustom(cats);
      setSubcats(subs);
    } catch (e) {
      console.error(e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // 로그인 확정 시 한 번 더 불러오기 (인증 전파 레이스 방지)
    const {
      data: { subscription },
    } = createClient().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") reload();
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 토스트 자동 사라짐
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // 메인 카테고리 바뀌면 세부 필터 초기화
  useEffect(() => {
    setSubFilter("all");
  }, [filter]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const it of items) m[it.category] = (m[it.category] ?? 0) + 1;
    return m;
  }, [items]);

  const subCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const it of items)
      if (it.subcategory) m[it.subcategory] = (m[it.subcategory] ?? 0) + 1;
    return m;
  }, [items]);

  const favCount = useMemo(
    () => items.filter((i) => i.is_favorite).length,
    [items],
  );
  const packedCount = useMemo(
    () => items.filter((i) => i.is_packed).length,
    [items],
  );

  const visible = useMemo(() => {
    let list = items;
    if (filter === "favorite") list = items.filter((i) => i.is_favorite);
    else if (filter !== "all") list = items.filter((i) => i.category === filter);
    if (filter !== "all" && filter !== "favorite" && subFilter !== "all")
      list = list.filter((i) => i.subcategory === subFilter);
    if (seasonFilter !== "all")
      list = list.filter((i) => i.season === seasonFilter);
    // 이름 검색
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((i) => (i.name ?? "").toLowerCase().includes(q));
    // 패킹 모드에서 '안 담은 옷만' 보기
    if (packing && unpackedOnly) list = list.filter((i) => !i.is_packed);
    return list;
  }, [items, filter, subFilter, seasonFilter, search, packing, unpackedOnly]);

  // 앱 톤의 확인 모달 (브라우저 confirm 대체)
  function askConfirm(opts: ConfirmOpts): Promise<boolean> {
    return new Promise((resolve) => setConfirmDialog({ ...opts, resolve }));
  }

  function showToast(msg: string, onRetry?: () => void) {
    setToast({ msg, onRetry });
  }

  // DB 저장을 감싸 실패 시 '다시 시도' 토스트를 띄움
  async function persist(fn: () => Promise<unknown>, errMsg: string) {
    try {
      await fn();
    } catch (e) {
      console.error(e);
      showToast(errMsg, () => persist(fn, errMsg));
    }
  }

  // 현재 선택된 메인 카테고리의 세부 카테고리들
  const activeSubcats = useMemo(
    () =>
      filter === "all" || filter === "favorite"
        ? []
        : subcats.filter((s) => s.parent === filter),
    [subcats, filter],
  );

  const rows = useMemo(() => chunk(visible, 2), [visible]);

  async function handleLogout() {
    // signOut 하면 App 의 onAuthStateChange 가 로그인 화면으로 전환해줌
    await createClient().auth.signOut();
  }

  async function handleDelete(item: Clothing) {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    closeTop();
    await persist(() => deleteClothing(item), "삭제에 실패했어요");
  }

  async function handleChangeCategory(item: Clothing, category: string) {
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, category } : i)),
    );
    setSelected((s) => (s ? { ...s, category } : s));
    await persist(
      () => updateClothing(item.id, { category }),
      "변경사항을 저장하지 못했어요",
    );
  }

  async function toggleFavorite(item: Clothing) {
    const next = !item.is_favorite;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_favorite: next } : i)),
    );
    setSelected((s) =>
      s && s.id === item.id ? { ...s, is_favorite: next } : s,
    );
    await persist(
      () => updateClothing(item.id, { is_favorite: next }),
      "변경사항을 저장하지 못했어요",
    );
  }

  async function handleSetSeason(item: Clothing, season: string | null) {
    const next = item.season === season ? null : season; // 다시 누르면 해제
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, season: next } : i)),
    );
    setSelected((s) => (s && s.id === item.id ? { ...s, season: next } : s));
    await persist(
      () => updateClothing(item.id, { season: next }),
      "변경사항을 저장하지 못했어요",
    );
  }

  async function handleRename(item: Clothing, name: string) {
    const value = name.trim() || null;
    if ((item.name ?? null) === value) return;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, name: value } : i)),
    );
    setSelected((s) => (s && s.id === item.id ? { ...s, name: value } : s));
    await persist(
      () => updateClothing(item.id, { name: value }),
      "이름을 저장하지 못했어요",
    );
  }

  async function togglePacked(item: Clothing) {
    const next = !item.is_packed;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_packed: next } : i)),
    );
    await persist(
      () => updateClothing(item.id, { is_packed: next }),
      "저장에 실패했어요",
    );
  }

  async function handleResetPacked() {
    const ok = await askConfirm({
      title: "챙김 표시를 모두 지울까요?",
      message: "체크한 옷들의 '챙김' 표시가 초기화돼요.",
      confirmText: "초기화",
    });
    if (!ok) return;
    setItems((prev) => prev.map((i) => ({ ...i, is_packed: false })));
    await persist(() => resetAllPacked(), "초기화에 실패했어요");
  }

  async function handleAddCategory(label: string, emoji: string) {
    try {
      const cat = await addCustomCategory(label, emoji);
      setCustom((prev) => [...prev, cat]);
    } catch (e) {
      console.error(e);
      showToast("카테고리 추가에 실패했어요");
    }
  }

  // 추가 화면에서 새 메인 카테고리 즉석 생성 (생성된 항목을 돌려줌)
  async function handleAddCategoryReturning(label: string) {
    const cat = await addCustomCategory(label, "🏷️");
    setCustom((prev) => [...prev, cat]);
    return cat;
  }

  // 기본 카테고리 숨기기/복원 (localStorage 저장, 옷 데이터는 그대로 유지)
  function handleToggleHide(cat: EffectiveCategory) {
    const next = hidden.includes(cat.id)
      ? hidden.filter((x) => x !== cat.id)
      : [...hidden, cat.id];
    setHidden(next);
    try {
      localStorage.setItem(HIDDEN_CATS_KEY, JSON.stringify(next));
    } catch {
      // 저장 실패해도 무시
    }
    if (!hidden.includes(cat.id) && filter === cat.id) setFilter("all");
  }

  function handleReplayTour() {
    closeTop();
    onReplayTour();
  }

  async function handleDeleteCategory(cat: EffectiveCategory) {
    const inCat = items.filter((i) => i.category === cat.id);
    const ok = await askConfirm({
      title: `'${cat.label}' 카테고리를 삭제할까요?`,
      message:
        inCat.length > 0
          ? `이 카테고리에 저장된 옷 ${inCat.length}벌도 함께 삭제돼요. 되돌릴 수 없어요.`
          : "되돌릴 수 없어요.",
      confirmText: "삭제",
      danger: true,
    });
    if (!ok) return;
    // 이 카테고리의 옷 + 카테고리를 함께 삭제
    const delIds = new Set(inCat.map((i) => i.id));
    setItems((prev) => prev.filter((i) => !delIds.has(i.id)));
    setCustom((prev) => prev.filter((c) => c.id !== cat.id));
    if (filter === cat.id) setFilter("all");
    try {
      await Promise.all(inCat.map((i) => deleteClothing(i)));
      await deleteCustomCategory(cat.id);
    } catch (e) {
      console.error(e);
      showToast("삭제 중 문제가 발생했어요");
    }
  }

  async function handleAddSub(parent: string, label: string) {
    try {
      const sub = await addSubcategory(parent, label);
      setSubcats((prev) => [...prev, sub]);
    } catch (e) {
      console.error(e);
      showToast("세부 추가에 실패했어요");
    }
  }

  // 추가 화면에서 세부 카테고리 즉석 생성 (생성된 항목을 돌려줌)
  async function handleAddSubcategoryReturning(parent: string, label: string) {
    const sub = await addSubcategory(parent, label);
    setSubcats((prev) => [...prev, sub]);
    return sub;
  }

  async function handleRenameCategory(cat: EffectiveCategory, label: string) {
    const v = label.trim();
    if (!v || cat.builtin || v === cat.label) return;
    setCustom((prev) =>
      prev.map((c) => (c.id === cat.id ? { ...c, label: v } : c)),
    );
    try {
      await updateCustomCategory(cat.id, { label: v });
    } catch (e) {
      console.error(e);
    }
  }

  async function handleRenameSub(sub: Subcategory, label: string) {
    const v = label.trim();
    if (!v || v === sub.label) return;
    setSubcats((prev) =>
      prev.map((s) => (s.id === sub.id ? { ...s, label: v } : s)),
    );
    try {
      await updateSubcategory(sub.id, v);
    } catch (e) {
      console.error(e);
    }
  }

  // 옷 편집 화면에서 새 메인 카테고리 추가 + 즉시 지정
  async function handleAddCategoryFromDetail(item: Clothing, label: string) {
    try {
      const cat = await addCustomCategory(label, "🏷️");
      setCustom((prev) => [...prev, cat]);
      handleChangeCategory(item, cat.id);
    } catch (e) {
      console.error(e);
    }
  }

  // 옷 편집 화면에서 새 세부 카테고리 추가 + 즉시 지정
  async function handleAddSubFromDetail(item: Clothing, label: string) {
    try {
      const sub = await addSubcategory(item.category, label);
      setSubcats((prev) => [...prev, sub]);
      handleSetItemSub(item, sub.id);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDeleteSub(sub: Subcategory) {
    const ok = await askConfirm({
      title: `세부 '${sub.label}' 삭제할까요?`,
      message: "이 세부 분류만 없어지고, 옷은 그대로 남아요.",
      confirmText: "삭제",
      danger: true,
    });
    if (!ok) return;
    setSubcats((prev) => prev.filter((s) => s.id !== sub.id));
    if (subFilter === sub.id) setSubFilter("all");
    // 이 세부에 속했던 옷들은 세부 해제
    setItems((prev) =>
      prev.map((i) =>
        i.subcategory === sub.id ? { ...i, subcategory: null } : i,
      ),
    );
    try {
      await deleteSubcategory(sub.id);
    } catch (e) {
      console.error(e);
      showToast("세부 삭제에 실패했어요");
    }
  }

  async function handleSetItemSub(item: Clothing, subId: string | null) {
    const next = item.subcategory === subId ? null : subId; // 다시 누르면 해제
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, subcategory: next } : i)),
    );
    setSelected((s) => (s && s.id === item.id ? { ...s, subcategory: next } : s));
    await persist(
      () => updateClothing(item.id, { subcategory: next }),
      "변경사항을 저장하지 못했어요",
    );
  }

  function applyUpdated(updated: Clothing) {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setSelected((s) => (s && s.id === updated.id ? updated : s));
  }

  async function handleReplace(
    item: Clothing,
    pair: { sticker: Blob; cutout: Blob },
  ) {
    try {
      const updated = await replaceImage(item, pair);
      applyUpdated(updated);
    } catch (e) {
      console.error(e);
      showToast("사진 변경에 실패했어요");
    }
  }

  async function handleEditedCutout(blob: Blob) {
    const item = editTarget;
    closeTop();
    if (!item) return;
    try {
      const updated = await replaceImage(item, { sticker: blob, cutout: blob });
      applyUpdated(updated);
    } catch (e) {
      console.error(e);
      showToast("편집 저장에 실패했어요");
    }
  }

  return (
    <main className="relative mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden bg-white">
      {/* 헤더 */}
      <header className="flex shrink-0 items-start justify-between px-6 pb-3 pt-5">
        <div>
          <h1
            className="font-display text-[30px] leading-none"
            style={{ color: TANGERINE, letterSpacing: ".5px" }}
          >
            CLOSET
          </h1>
          <p
            className="mt-2 text-[11px] font-semibold uppercase"
            style={{ color: MUTED, letterSpacing: ".12em" }}
          >
            {packing
              ? `PACKING · 챙김 ${packedCount}/${items.length}`
              : `${items.length}벌`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterOpen(true)}
            aria-label="필터"
            className="flex h-[30px] items-center gap-1 rounded-full border-2 px-3 text-xs font-bold transition active:scale-95"
            style={
              search.trim() || seasonFilter !== "all"
                ? { background: TANGERINE, color: "#FFF6F0", borderColor: INK }
                : { background: "transparent", borderColor: LINE, color: MUTED }
            }
          >
            ⚟ 필터
          </button>
          <button
            onClick={() => {
              openSheet(() => setProfileOpen(false));
              setProfileOpen(true);
            }}
            aria-label="메뉴"
            className="flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 text-sm transition active:scale-95"
            style={{ background: "transparent", borderColor: LINE, color: MUTED }}
          >
            ☰
          </button>
        </div>
      </header>

      {/* 패킹 진행 바 */}
      {packing && items.length > 0 && (
        <div className="shrink-0 px-6 pb-3">
          <div
            className="mb-1.5 flex items-center justify-between text-[10.5px] font-bold uppercase tracking-wider"
            style={{ color: MUTED }}
          >
            <span>가방에 담은 옷 (탭해서 체크)</span>
            <button onClick={handleResetPacked} className="underline">
              초기화
            </button>
          </div>
          <div
            className="h-2.5 w-full overflow-hidden rounded-full border"
            style={{ borderColor: LINE, background: "#FFF6F0" }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${
                  items.length ? (packedCount / items.length) * 100 : 0
                }%`,
                background: TANGERINE,
              }}
            />
          </div>
          {/* 짐 다 쌌을 때 축하 */}
          {packedCount === items.length && (
            <p
              className="font-kr mt-2 animate-pulse text-center text-sm font-bold"
              style={{ color: TANGERINE }}
            >
              🎉 짐 다 쌌어요! 이제 떠날 준비 끝!
            </p>
          )}
          {/* 안 담은 옷만 보기 토글 */}
          <button
            onClick={() => setUnpackedOnly((v) => !v)}
            className="mt-2 rounded-full border-2 px-3 py-1.5 text-[11px] font-bold transition active:scale-95"
            style={
              unpackedOnly
                ? { background: TANGERINE, color: "#FFF6F0", borderColor: INK }
                : { background: "transparent", color: MUTED, borderColor: LINE }
            }
          >
            {unpackedOnly ? "✓ 안 담은 옷만 보는 중" : "안 담은 옷만 보기"}
          </button>
        </div>
      )}

      {/* 카테고리 필터 */}
      <div className="shrink-0 px-6 pb-4">
        <nav
          data-tour="shelves"
          className="no-scrollbar flex gap-2 overflow-x-auto"
        >
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>
            전체 {items.length}
          </Chip>
          <Chip
            active={filter === "favorite"}
            onClick={() => setFilter("favorite")}
          >
            ⭐ {favCount}
          </Chip>
          {categories.map((c) => (
            <Chip
              key={c.id}
              active={filter === c.id}
              onClick={() => setFilter(c.id)}
            >
              {c.label} {counts[c.id] ?? 0}
            </Chip>
          ))}
          <button
            onClick={() => {
              openSheet(() => setCatOpen(false));
              setCatOpen(true);
            }}
            className="flex shrink-0 items-center gap-1 rounded-full border-2 border-dashed px-3.5 py-2 text-xs font-bold uppercase transition active:scale-95"
            style={{ borderColor: LINE, color: MUTED }}
          >
            ＋ 카테고리
          </button>
        </nav>
      </div>

      {/* 세부 카테고리 필터 (메인 카테고리 선택 시 하단에 표시) */}
      {filter !== "all" && filter !== "favorite" && activeSubcats.length > 0 && (
        <nav className="no-scrollbar flex shrink-0 items-center gap-2 px-6 pb-3">
          <span className="shrink-0 text-[15px]" style={{ color: MUTED }}>
            ↳
          </span>
          <SubChip
            active={subFilter === "all"}
            onClick={() => setSubFilter("all")}
          >
            전체 {counts[filter] ?? 0}
          </SubChip>
          {activeSubcats.map((s) => (
            <SubChip
              key={s.id}
              active={subFilter === s.id}
              onClick={() => setSubFilter(s.id)}
            >
              {s.label} {subCounts[s.id] ?? 0}
            </SubChip>
          ))}
        </nav>
      )}

      {/* 콘텐츠 영역 (남는 화면을 채움) */}
      <div className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
      {loading ? (
        <div className="px-6 pt-8">
          {[0, 1, 2].map((r) => (
            <div key={r} className="mb-9 flex justify-around gap-1">
              {[0, 1].map((c) => (
                <div
                  key={c}
                  className="flex w-[168px] flex-col items-center gap-3"
                >
                  <div
                    className="h-[180px] w-[118px] animate-pulse rounded-2xl"
                    style={{ background: "#FCEAE0" }}
                  />
                  <div
                    className="h-3 w-16 animate-pulse rounded-full"
                    style={{ background: "#FCEAE0" }}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div className="px-6 py-20 text-center">
          <div className="text-5xl">😵‍💫</div>
          <p className="mt-4 text-lg font-bold" style={{ color: INK }}>
            옷장을 불러오지 못했어요
          </p>
          <p className="mt-1 text-sm" style={{ color: MUTED }}>
            네트워크를 확인하고 다시 시도해 주세요
          </p>
          <button
            onClick={reload}
            className="font-kr mt-5 rounded-2xl border-2 px-6 py-3 text-sm font-bold text-white transition active:scale-95"
            style={{ background: TANGERINE, borderColor: INK }}
          >
            다시 시도
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="px-6 py-20 text-center">
          <div
            className="font-display mx-auto inline-block text-5xl"
            style={{ color: TANGERINE }}
          >
            ✳
          </div>
          <p className="mt-5 text-lg font-bold" style={{ color: INK }}>
            {filter === "favorite"
              ? "즐겨찾기한 옷이 없어요"
              : "옷장이 비어 있어요"}
          </p>
          <p className="mt-1 text-sm" style={{ color: MUTED }}>
            아래 <b style={{ color: TANGERINE }}>＋</b> 로 첫 옷을 걸어보세요
          </p>
        </div>
      ) : filter === "all" && !packing ? (
        <ScatterBoard
          items={visible}
          onOpen={openItem}
          onMove={handleMovePosition}
        />
      ) : (
        <div className="px-6 pb-32">
          {rows.map((row, ri) => (
            <div key={ri} className="relative mb-9 pt-6">
              {/* 옷걸이 봉 */}
              <div
                className="absolute inset-x-0 top-4 h-1 rounded"
                style={{ background: TANGERINE, boxShadow: "0 2px 0 #C63F1E" }}
              />
              <div
                className="absolute -left-0.5 top-[13px] h-2.5 w-2.5 rounded-full"
                style={{ background: INK }}
              />
              <div
                className="absolute -right-0.5 top-[13px] h-2.5 w-2.5 rounded-full"
                style={{ background: INK }}
              />
              <div className="relative flex justify-around gap-1">
                {row.map((item, ii) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (packing) togglePacked(item);
                      else openItem(item);
                    }}
                    className={`relative z-10 -mt-5 flex w-[168px] cursor-pointer flex-col items-center transition ${
                      packing && item.is_packed ? "opacity-40" : ""
                    }`}
                    style={{
                      transformOrigin: "top center",
                      animation: "sway 3.6s ease-in-out infinite",
                      animationDelay: `${ii * 0.15}s`,
                    }}
                  >
                    {/* 옷걸이 후크 */}
                    <span
                      className="z-10 mb-0.5 h-6 w-[15px] rounded-t-[10px] border-[1.5px] border-b-0"
                      style={{ borderColor: INK }}
                    />
                    <div className="relative -mt-1.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={displaySrc(item)}
                        alt={
                          item.name ?? findCategory(item.category, categories).label
                        }
                        style={{
                          height: 210 * (item.scale ?? 1),
                          transform: `translateY(${item.offset_y ?? 0}px)`,
                        }}
                        className={`w-auto max-w-full object-contain ${
                          item.cutout_url ? "cutout" : ""
                        }`}
                      />

                      {/* 즐겨찾기 별 (패킹 모드 아닐 때) */}
                      {!packing && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(item);
                          }}
                          className="absolute -right-1 -top-1 text-base leading-none drop-shadow"
                          aria-label="즐겨찾기"
                        >
                          {item.is_favorite ? "⭐" : "☆"}
                        </button>
                      )}

                      {/* 패킹 체크 */}
                      {packing && (
                        <span
                          className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs"
                          style={
                            item.is_packed
                              ? {
                                  background: TANGERINE,
                                  borderColor: INK,
                                  color: "#fff",
                                }
                              : {
                                  background: "#fff",
                                  borderColor: LINE,
                                  color: "transparent",
                                }
                          }
                        >
                          ✓
                        </span>
                      )}
                    </div>
                    <span
                      className="mt-3 max-w-full truncate text-[10px] font-semibold uppercase tracking-wide"
                      style={{ color: INK }}
                    >
                      {item.name ?? findCategory(item.category, categories).label}
                    </span>
                  </div>
                ))}
                {/* 빈 칸 채우기 (정렬 유지) */}
                {row.length < 2 &&
                  Array.from({ length: 2 - row.length }).map((_, k) => (
                    <div key={`sp-${k}`} className="w-[168px]" />
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
      </div>

      {/* 하단 페이드 (탭바 위) */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[58px] z-30 mx-auto h-20 max-w-md"
        style={{ background: "linear-gradient(to top, #fff 42%, transparent)" }}
      />

      {/* 옷 추가 FAB (탭바 위) */}
      {!packing && (
        <button
          data-tour="add"
          onClick={() => {
            openSheet(() => setAddOpen(false));
            setAddOpen(true);
          }}
          aria-label="옷 추가"
          className="fixed bottom-[74px] right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full border-2 text-3xl leading-none text-white transition active:translate-y-0.5"
          style={{
            background: TANGERINE,
            borderColor: INK,
            boxShadow: "0 12px 26px -6px rgba(255,106,61,.55)",
          }}
        >
          ＋
        </button>
      )}

      {/* 하단 탭바 */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md border-t-2 bg-white"
        style={{ borderColor: INK }}
      >
        <TabButton
          emoji="🧺"
          label="옷장"
          active={!packing}
          onClick={() => setPacking(false)}
        />
        <TabButton
          emoji="🎽"
          label="코디"
          dataTour="coordi"
          active={false}
          onClick={() => {
            openSheet(() => setCoordiOpen(false));
            setCoordiOpen(true);
          }}
        />
        <TabButton
          emoji="🧳"
          label="패킹"
          dataTour="packing"
          active={packing}
          onClick={() => setPacking((v) => !v)}
        />
      </nav>

      {addOpen && (
        <AddSheet
          categories={categories}
          subcats={subcats}
          onAddSubcategory={handleAddSubcategoryReturning}
          onAddCategory={handleAddCategoryReturning}
          onClose={closeTop}
          onAddedMany={(newItems) => {
            setItems((prev) => [...newItems, ...prev]);
            closeTop();
          }}
        />
      )}

      {catOpen && (
        <CategorySheet
          categories={allCategories}
          subcats={subcats}
          catCounts={counts}
          subCounts={subCounts}
          hidden={hidden}
          onAddCategory={handleAddCategory}
          onRenameCategory={handleRenameCategory}
          onDeleteCategory={handleDeleteCategory}
          onToggleHide={handleToggleHide}
          onAddSub={handleAddSub}
          onRenameSub={handleRenameSub}
          onDeleteSub={handleDeleteSub}
          onClose={closeTop}
        />
      )}

      {selected && (
        <DetailSheet
          item={selected}
          categories={categories}
          subcats={subcats}
          onClose={closeTop}
          onDelete={handleDelete}
          onChangeCategory={handleChangeCategory}
          onToggleFavorite={toggleFavorite}
          onRename={handleRename}
          onSetSeason={handleSetSeason}
          onSetSub={handleSetItemSub}
          onAddCategory={handleAddCategoryFromDetail}
          onAddSub={handleAddSubFromDetail}
          onReplace={handleReplace}
          onEditCutout={(item) => {
            openSheet(() => setEditTarget(null));
            setEditTarget(item);
          }}
        />
      )}

      {editTarget && (
        <ImageEditor
          src={editTarget.cutout_url ?? editTarget.image_url}
          onCancel={closeTop}
          onSave={handleEditedCutout}
        />
      )}

      {coordiOpen && (
        <CoordiSheet
          items={items}
          categories={categories}
          onClose={closeTop}
        />
      )}

      {profileOpen && (
        <ProfileSheet
          onClose={closeTop}
          onReplayTour={handleReplayTour}
          onLogout={handleLogout}
          onPrivacy={() => {
            closeTop();
            showToast("개인정보처리방침은 준비 중이에요");
          }}
        />
      )}

      {filterOpen && (
        <FilterSheet
          season={seasonFilter}
          onSeason={setSeasonFilter}
          search={search}
          onSearch={setSearch}
          onClose={() => setFilterOpen(false)}
        />
      )}

      {confirmDialog && (
        <ConfirmModal
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText={confirmDialog.confirmText}
          danger={confirmDialog.danger}
          onResult={(v) => {
            confirmDialog.resolve(v);
            setConfirmDialog(null);
          }}
        />
      )}

      {/* 에러 토스트 */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[75] mx-auto flex max-w-md justify-center px-6">
          <div
            className="pointer-events-auto flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-sm font-bold text-white"
            style={{ background: INK, borderColor: INK }}
          >
            <span>{toast.msg}</span>
            {toast.onRetry && (
              <button
                onClick={() => {
                  const retry = toast.onRetry!;
                  setToast(null);
                  retry();
                }}
                className="rounded-full px-2.5 py-1 text-xs"
                style={{ background: TANGERINE }}
              >
                다시 시도
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex shrink-0 items-center gap-1.5 rounded-full border-2 px-3.5 py-2 text-xs font-bold uppercase tracking-wide transition active:scale-95"
      style={
        active
          ? { background: TANGERINE, color: "#FFF6F0", borderColor: INK }
          : { background: "transparent", color: MUTED, borderColor: LINE }
      }
    >
      {children}
    </button>
  );
}

function ConfirmModal({
  title,
  message,
  confirmText = "확인",
  danger,
  onResult,
}: {
  title: string;
  message?: string;
  confirmText?: string;
  danger?: boolean;
  onResult: (v: boolean) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center px-8"
      style={{ background: "rgba(20,15,40,.55)" }}
      onClick={() => onResult(false)}
    >
      <div
        className="w-full max-w-xs rounded-3xl border-2 bg-white p-5"
        style={{ borderColor: INK, boxShadow: "0 18px 40px -12px rgba(0,0,0,.4)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-kr text-lg font-bold" style={{ color: INK }}>
          {title}
        </p>
        {message && (
          <p
            className="mt-1.5 text-sm leading-relaxed"
            style={{ color: danger ? "#C63F1E" : MUTED }}
          >
            {message}
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => onResult(false)}
            className="font-kr flex-1 rounded-2xl border-2 py-3 text-sm font-bold transition active:scale-[.98]"
            style={{ borderColor: LINE, color: MUTED }}
          >
            취소
          </button>
          <button
            onClick={() => onResult(true)}
            className="font-kr flex-1 rounded-2xl border-2 py-3 text-sm font-bold text-white transition active:scale-[.98]"
            style={{
              background: danger ? "#C63F1E" : TANGERINE,
              borderColor: INK,
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  emoji,
  label,
  active,
  onClick,
  dataTour,
}: {
  emoji: string;
  label: string;
  active: boolean;
  onClick: () => void;
  dataTour?: string;
}) {
  return (
    <button
      data-tour={dataTour}
      onClick={onClick}
      className="flex flex-1 flex-col items-center gap-0.5 py-2 pb-2.5 text-[10px] font-bold uppercase tracking-wide transition active:scale-95"
      style={{ color: active ? TANGERINE : MUTED }}
    >
      <span
        className="text-[19px] leading-none"
        style={{ filter: active ? "none" : "grayscale(0.5) opacity(0.85)" }}
      >
        {emoji}
      </span>
      {label}
    </button>
  );
}

function MenuRow({
  emoji,
  label,
  onClick,
  danger,
}: {
  emoji: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left text-sm font-bold transition active:scale-[.98]"
      style={{ borderColor: LINE, color: danger ? "#C63F1E" : INK }}
    >
      <span className="text-lg">{emoji}</span>
      <span className="flex-1">{label}</span>
      <span style={{ color: MUTED }}>›</span>
    </button>
  );
}

function ProfileSheet({
  onClose,
  onReplayTour,
  onLogout,
  onPrivacy,
}: {
  onClose: () => void;
  onReplayTour: () => void;
  onLogout: () => void;
  onPrivacy: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(20,15,40,.5)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-[28px] border-t-2 bg-white p-6 pb-9"
        style={{ borderColor: INK }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="mx-auto mb-4 h-1.5 w-11 rounded-full"
          style={{ background: LINE }}
        />
        <h2 className="mb-4 text-xl font-bold" style={{ color: INK }}>
          메뉴
        </h2>
        <div className="space-y-2">
          <MenuRow
            emoji="📖"
            label="앱 사용법 다시 보기"
            onClick={onReplayTour}
          />
          <MenuRow emoji="🔒" label="개인정보처리방침" onClick={onPrivacy} />
          <MenuRow emoji="🚪" label="로그아웃" onClick={onLogout} danger />
        </div>
      </div>
    </div>
  );
}

function FilterSheet({
  season,
  onSeason,
  search,
  onSearch,
  onClose,
}: {
  season: string;
  onSeason: (v: string) => void;
  search: string;
  onSearch: (v: string) => void;
  onClose: () => void;
}) {
  const opts = [
    { id: "all", emoji: "🗓", label: "전체" },
    ...SEASONS.map((s) => ({ id: s.id, emoji: s.emoji, label: s.id })),
  ];
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(20,15,40,.5)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-[28px] border-t-2 bg-white p-6 pb-9"
        style={{ borderColor: INK }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="mx-auto mb-4 h-1.5 w-11 rounded-full"
          style={{ background: LINE }}
        />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold" style={{ color: INK }}>
            검색 · 필터
          </h2>
          {(search.trim() || season !== "all") && (
            <button
              onClick={() => {
                onSearch("");
                onSeason("all");
              }}
              className="text-xs font-bold underline"
              style={{ color: MUTED }}
            >
              초기화
            </button>
          )}
        </div>

        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="🔍 옷 이름으로 검색"
          className="mb-5 w-full rounded-2xl border-2 px-4 py-3 text-sm outline-none"
          style={{ borderColor: LINE, color: INK }}
        />

        <p
          className="mb-2 text-[10.5px] font-bold uppercase tracking-wider"
          style={{ color: MUTED }}
        >
          계절
        </p>
        <div className="grid grid-cols-3 gap-2">
          {opts.map((o) => {
            const active = season === o.id;
            return (
              <button
                key={o.id}
                onClick={() => onSeason(o.id)}
                className="flex flex-col items-center gap-1 rounded-2xl border-2 py-4 text-sm font-bold transition active:scale-95"
                style={
                  active
                    ? { background: TANGERINE, color: "#FFF6F0", borderColor: INK }
                    : { background: "#fff", color: MUTED, borderColor: LINE }
                }
              >
                <span className="text-2xl">{o.emoji}</span>
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ScatterBoard({
  items,
  onOpen,
  onMove,
}: {
  items: Clothing[];
  onOpen: (item: Clothing) => void;
  onMove: (item: Clothing, x: number, y: number) => void;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(
    null,
  );

  const n = items.length;
  // 한 화면(보드)에 모두 들어오도록: 지터 격자 분포 + 개수에 따라 크기 자동 축소
  const cols = Math.max(2, Math.round(Math.sqrt(n * 0.62)));
  const rows = Math.max(1, Math.ceil(n / cols));
  const itemH = Math.round(Math.min(232, Math.max(84, 940 / rows)));
  const PADX = 0.09;
  const PADT = 0.07;
  const PADB = 0.15;

  function startDrag(e: React.PointerEvent, item: Clothing) {
    const rect = boardRef.current!.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;
    const toFrac = (ev: PointerEvent | React.PointerEvent) => ({
      x: Math.min(0.95, Math.max(0.05, (ev.clientX - rect.left) / rect.width)),
      y: Math.min(0.95, Math.max(0.05, (ev.clientY - rect.top) / rect.height)),
    });
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 6)
        moved = true;
      if (moved) setDrag({ id: item.id, ...toFrac(ev) });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (moved) {
        const f = toFrac(ev);
        onMove(item, f.x, f.y);
      } else {
        onOpen(item);
      }
      setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  return (
    <div ref={boardRef} className="relative h-full w-full">
      {items.map((item, i) => {
        const rng = rngFrom(hashId(item.id));
        const col = i % cols;
        const row = Math.floor(i / cols);
        const spanX = 1 - 2 * PADX;
        const spanY = 1 - PADT - PADB;
        let fx =
          PADX + ((col + 0.5) / cols) * spanX + (rng() - 0.5) * (spanX / cols);
        let fy =
          PADT + ((row + 0.5) / rows) * spanY + (rng() - 0.5) * (spanY / rows);
        fx = Math.min(1 - PADX, Math.max(PADX, fx));
        fy = Math.min(1 - PADB, Math.max(PADT, fy));
        // 저장된 위치 우선, 드래그 중이면 실시간 위치
        if (item.board_x != null && item.board_y != null) {
          fx = item.board_x;
          fy = item.board_y;
        }
        const dragging = drag?.id === item.id;
        if (dragging) {
          fx = drag!.x;
          fy = drag!.y;
        }
        const rot = (rng() - 0.5) * 42;
        const dur = 5 + rng() * 5;
        const delay = -rng() * 8;
        const dx = 3 + rng() * 5;
        const dy = -(5 + rng() * 7);
        const innerStyle = {
          "--rot": `${rot}deg`,
          "--dx": `${dx}px`,
          "--dy": `${dy}px`,
          animation: dragging
            ? "none"
            : `float ${dur}s ease-in-out ${delay}s infinite`,
        } as React.CSSProperties;
        return (
          <div
            key={item.id}
            onPointerDown={(e) => startDrag(e, item)}
            className="absolute cursor-grab touch-none select-none active:cursor-grabbing"
            style={{
              left: `${fx * 100}%`,
              top: `${fy * 100}%`,
              transform: "translate(-50%,-50%)",
              zIndex: dragging ? 50 : 1,
            }}
          >
            <div style={innerStyle}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={displaySrc(item)}
                alt={item.name ?? ""}
                draggable={false}
                style={{ height: itemH, maxWidth: itemH * 1.5 }}
                className={`w-auto object-contain ${
                  dragging ? "scale-105" : ""
                } ${item.cutout_url ? "cutout" : ""}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SubChip({
  active,
  onClick,
  onDelete,
  children,
}: {
  active: boolean;
  onClick: () => void;
  onDelete?: () => void;
  children: React.ReactNode;
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full border-2 px-3 py-1 text-xs font-bold transition"
      style={
        active
          ? { background: TANGERINE, color: "#FFF6F0", borderColor: INK }
          : { background: "transparent", color: MUTED, borderColor: LINE }
      }
    >
      <button onClick={onClick}>{children}</button>
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="opacity-70"
          aria-label="세부 삭제"
        >
          ✕
        </button>
      )}
    </span>
  );
}

function DetailSheet({
  item,
  categories,
  subcats,
  onClose,
  onDelete,
  onChangeCategory,
  onToggleFavorite,
  onRename,
  onSetSeason,
  onSetSub,
  onAddCategory,
  onAddSub,
  onReplace,
  onEditCutout,
}: {
  item: Clothing;
  categories: EffectiveCategory[];
  subcats: Subcategory[];
  onClose: () => void;
  onDelete: (item: Clothing) => void;
  onChangeCategory: (item: Clothing, category: string) => void;
  onToggleFavorite: (item: Clothing) => void;
  onRename: (item: Clothing, name: string) => void;
  onSetSeason: (item: Clothing, season: string | null) => void;
  onSetSub: (item: Clothing, subId: string | null) => void;
  onAddCategory: (item: Clothing, label: string) => void;
  onAddSub: (item: Clothing, label: string) => void;
  onReplace: (
    item: Clothing,
    pair: { sticker: Blob; cutout: Blob },
  ) => Promise<void>;
  onEditCutout: (item: Clothing) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState("");
  const [name, setName] = useState(item.name ?? "");
  useEffect(() => setName(item.name ?? ""), [item.id, item.name]);
  const [catAdding, setCatAdding] = useState(false);
  const [catVal, setCatVal] = useState("");
  const [subAdding, setSubAdding] = useState(false);
  const [subVal, setSubVal] = useState("");
  const itemSubs = subcats.filter((s) => s.parent === item.category);

  async function handleNewPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy("배경 지우는 중…");
    try {
      const { makeSticker } = await import("@/lib/sticker");
      const pair = await makeSticker(file, {
        onProgress: (p, ratio) =>
          setBusy(
            p === "download"
              ? `누끼 엔진 준비 중… ${Math.round(ratio * 100)}%`
              : `배경 지우는 중… ${Math.round(ratio * 100)}%`,
          ),
      });
      await onReplace(item, pair);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy("");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(20,15,40,.5)" }}
      onClick={onClose}
    >
      <div
        className="no-scrollbar max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] border-t-2 bg-white p-6 pb-9"
        style={{ borderColor: INK }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="mx-auto mb-4 h-1.5 w-11 rounded-full"
          style={{ background: LINE }}
        />
        <div className="mb-4 flex items-center justify-between">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => onRename(item, name)}
            placeholder={findCategory(item.category, categories).label}
            className="min-w-0 flex-1 truncate bg-transparent text-xl font-bold outline-none"
            style={{ color: INK }}
          />
          <div className="ml-2 flex shrink-0 items-center gap-2">
            <button
              onClick={() => onToggleFavorite(item)}
              className="text-2xl leading-none"
              aria-label="즐겨찾기"
            >
              {item.is_favorite ? "⭐" : "☆"}
            </button>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full border"
              style={{ borderColor: LINE, color: MUTED }}
            >
              ✕
            </button>
          </div>
        </div>

        <div
          className="relative mb-4 flex items-center justify-center overflow-hidden rounded-[20px] border-2"
          style={{
            aspectRatio: "1.3",
            background: "#FFF6F0",
            borderColor: INK,
            boxShadow: "5px 5px 0 #FF6A3D",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displaySrc(item)}
            alt={item.name ?? ""}
            style={{
              maxHeight: `${Math.min(94, 78 * (item.scale ?? 1))}%`,
              maxWidth: `${Math.min(94, 78 * (item.scale ?? 1))}%`,
              transform: `translateY(${(item.offset_y ?? 0) * 0.5}px)`,
            }}
            className={`object-contain ${item.cutout_url ? "cutout" : ""}`}
          />
          {busy && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[18px]"
              style={{ background: "rgba(255,246,240,.9)", color: INK }}
            >
              <div
                className="h-9 w-9 animate-spin rounded-full border-[5px]"
                style={{ borderColor: "#FADFD1", borderTopColor: TANGERINE }}
              />
              <span className="text-sm font-bold">{busy}</span>
            </div>
          )}
        </div>

        {/* 누끼 편집 / 사진 교체 */}
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => onEditCutout(item)}
            className="font-kr flex-1 rounded-2xl border-2 py-3 text-sm font-bold transition active:scale-[.98]"
            style={{ borderColor: INK, color: INK }}
          >
            ✂️ 누끼 편집
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="font-kr flex-1 rounded-2xl border-2 py-3 text-sm font-bold transition active:scale-[.98]"
            style={{ borderColor: INK, color: INK }}
          >
            🔄 사진 교체
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleNewPhoto}
          />
        </div>

        {/* 계절 */}
        <p
          className="mb-2.5 text-[10.5px] font-bold uppercase tracking-wider"
          style={{ color: MUTED }}
        >
          계절
        </p>
        <div className="mb-5 flex flex-wrap gap-2">
          {SEASONS.map((s) => (
            <button
              key={s.id}
              onClick={() => onSetSeason(item, s.id)}
              className="rounded-full border-2 px-3 py-2 text-xs font-bold transition active:scale-95"
              style={
                item.season === s.id
                  ? { background: TANGERINE, color: "#FFF6F0", borderColor: INK }
                  : { background: "transparent", color: MUTED, borderColor: LINE }
              }
            >
              {s.emoji} {s.id}
            </button>
          ))}
        </div>

        <p
          className="mb-2.5 text-[10.5px] font-bold uppercase tracking-wider"
          style={{ color: MUTED }}
        >
          다른 카테고리로 옮기기
        </p>
        <div className="no-scrollbar mb-5 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => onChangeCategory(item, c.id)}
              className="rounded-full border-2 px-3 py-2 text-xs font-bold uppercase transition active:scale-95"
              style={
                item.category === c.id
                  ? { background: TANGERINE, color: "#FFF6F0", borderColor: INK }
                  : { background: "transparent", color: MUTED, borderColor: LINE }
              }
            >
              {c.label}
            </button>
          ))}
          {catAdding ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                (
                  e.currentTarget.querySelector("input") as HTMLInputElement | null
                )?.blur();
              }}
            >
              <input
                autoFocus
                value={catVal}
                onChange={(e) => setCatVal(e.target.value)}
                onBlur={() => {
                  if (catVal.trim()) onAddCategory(item, catVal.trim());
                  setCatVal("");
                  setCatAdding(false);
                }}
                placeholder="새 카테고리"
                className="w-24 rounded-full border-2 px-3 py-2 text-xs outline-none"
                style={{ borderColor: INK, color: INK }}
              />
            </form>
          ) : (
            <button
              onClick={() => setCatAdding(true)}
              className="rounded-full border-2 border-dashed px-3 py-2 text-xs font-bold"
              style={{ borderColor: LINE, color: MUTED }}
            >
              ＋
            </button>
          )}
        </div>

        {/* 세부 카테고리 지정 */}
        <p
          className="mb-2.5 text-[10.5px] font-bold uppercase tracking-wider"
          style={{ color: MUTED }}
        >
          세부 카테고리
        </p>
        <div className="mb-5 flex flex-wrap gap-2">
          {itemSubs.map((s) => (
            <button
              key={s.id}
              onClick={() => onSetSub(item, s.id)}
              className="rounded-full border-2 px-3 py-2 text-xs font-bold transition active:scale-95"
              style={
                item.subcategory === s.id
                  ? { background: TANGERINE, color: "#FFF6F0", borderColor: INK }
                  : { background: "transparent", color: MUTED, borderColor: LINE }
              }
            >
              {s.label}
            </button>
          ))}
          {subAdding ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                (
                  e.currentTarget.querySelector("input") as HTMLInputElement | null
                )?.blur();
              }}
            >
              <input
                autoFocus
                value={subVal}
                onChange={(e) => setSubVal(e.target.value)}
                onBlur={() => {
                  if (subVal.trim()) onAddSub(item, subVal.trim());
                  setSubVal("");
                  setSubAdding(false);
                }}
                placeholder="예: 반팔"
                className="w-24 rounded-full border-2 px-3 py-2 text-xs outline-none"
                style={{ borderColor: INK, color: INK }}
              />
            </form>
          ) : (
            <button
              onClick={() => setSubAdding(true)}
              className="rounded-full border-2 border-dashed px-3 py-2 text-xs font-bold"
              style={{ borderColor: LINE, color: MUTED }}
            >
              ＋ 세부
            </button>
          )}
        </div>

        <button
          onClick={() => onDelete(item)}
          className="font-kr w-full rounded-2xl border-2 py-3.5 text-sm font-bold transition active:scale-[.98]"
          style={{ borderColor: INK, color: INK, background: "transparent" }}
        >
          옷장에서 빼기
        </button>
      </div>
    </div>
  );
}
