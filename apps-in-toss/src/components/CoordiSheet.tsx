"use client";

import { useEffect, useMemo, useState } from "react";
import type { Clothing, EffectiveCategory } from "@/lib/categories";
import {
  fetchLookbooks,
  addLookbook,
  deleteLookbook,
  type Lookbook,
} from "@/lib/lookbook";

const TANGERINE = "#FF6A3D";
const INK = "#2A1206";
const MUTED = "#B0846A";
const LINE = "#F3C9B4";

const src = (i: Clothing) => i.cutout_url ?? i.image_url;

const COORDI_KEY = "mycloset_coordi_cats";
const DEFAULT_COORDI = ["outerwear", "top", "bottom", "shoes"];
// 위→아래 쌓임 순서 우선순위 (목록에 없는 커스텀 카테고리는 뒤로)
const PREF = [
  "outerwear",
  "top",
  "activewear",
  "bottom",
  "shoes",
  "accessory",
  "other",
];
const prefIdx = (id: string) => (PREF.indexOf(id) < 0 ? 99 : PREF.indexOf(id));
const OPTIONAL = new Set(["outerwear"]);
const smallCat = (id: string) => id === "shoes";

export default function CoordiSheet({
  items,
  categories,
  onClose,
}: {
  items: Clothing[];
  categories: EffectiveCategory[];
  onClose: () => void;
}) {
  const [coordiCats, setCoordiCats] = useState<string[]>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(COORDI_KEY) || "null");
      return Array.isArray(v) ? v : DEFAULT_COORDI;
    } catch {
      return DEFAULT_COORDI;
    }
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  function toggleCat(id: string) {
    setCoordiCats((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      try {
        localStorage.setItem(COORDI_KEY, JSON.stringify(next));
      } catch {
        // 무시
      }
      return next;
    });
  }

  // 선택된 코디 카테고리 중 옷이 있는 것만, 위→아래 순서로
  const cats = useMemo(
    () =>
      categories
        .filter(
          (c): c is EffectiveCategory =>
            coordiCats.includes(c.id) &&
            items.some((i) => i.category === c.id),
        )
        .sort((a, b) => prefIdx(a.id) - prefIdx(b.id)),
    [categories, items, coordiCats],
  );

  function randomPick(): Record<string, string | null> {
    const sel: Record<string, string | null> = {};
    for (const c of cats) {
      const pool = items.filter((i) => i.category === c.id);
      if (!pool.length) {
        sel[c.id] = null;
        continue;
      }
      // 아우터는 옵션 — 절반 확률로만 포함
      if (OPTIONAL.has(c.id) && Math.random() < 0.5) {
        sel[c.id] = null;
        continue;
      }
      sel[c.id] = pool[Math.floor(Math.random() * pool.length)].id;
    }
    return sel;
  }

  const [sel, setSel] = useState<Record<string, string | null>>(randomPick);

  // 코디 구성 카테고리를 바꾸면 새로 뽑기
  useEffect(() => {
    setSel(randomPick());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordiCats]);

  const chosen = useMemo(
    () =>
      cats
        .map((c) => items.find((i) => i.id === sel[c.id]))
        .filter((i): i is Clothing => !!i),
    [cats, sel, items],
  );

  // 아우터는 상의 뒤에 살짝 겹쳐 보이게 처리
  const outer = useMemo(
    () => chosen.find((i) => i.category === "outerwear") ?? null,
    [chosen],
  );
  const hasTop = chosen.some((i) => i.category === "top");
  const stack = useMemo(
    () => chosen.filter((i) => i.category !== "outerwear"),
    [chosen],
  );

  function toggle(catId: string, itemId: string) {
    setSel((s) => ({ ...s, [catId]: s[catId] === itemId ? null : itemId }));
  }

  // ---- 룩북 (저장한 코디) ----
  const [lookbooks, setLookbooks] = useState<Lookbook[]>([]);
  const [lookbookOpen, setLookbookOpen] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");

  useEffect(() => {
    fetchLookbooks()
      .then(setLookbooks)
      .catch((e) => console.error(e));
  }, []);

  function openSave() {
    if (chosen.length === 0) return;
    setSaveName(`코디 ${lookbooks.length + 1}`);
    setSaveOpen(true);
  }

  async function doSave() {
    const ids = chosen.map((i) => i.id);
    if (!ids.length) return;
    const name = saveName.trim() || `코디 ${lookbooks.length + 1}`;
    setSaveOpen(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1600);
    try {
      const lb = await addLookbook(name, ids);
      setLookbooks((prev) => [lb, ...prev]);
    } catch (e) {
      console.error(e);
    }
  }

  function loadLookbook(lb: Lookbook) {
    const next: Record<string, string | null> = {};
    for (const id of lb.item_ids) {
      const it = items.find((i) => i.id === id);
      if (it) next[it.category] = id;
    }
    setSel(next);
    setLookbookOpen(false);
  }

  async function removeLookbook(id: string) {
    setLookbooks((prev) => prev.filter((l) => l.id !== id));
    try {
      await deleteLookbook(id);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-white">
      <div
        className="relative flex h-full w-full max-w-md flex-col overflow-hidden"
        style={{ background: "#FFF6F0" }}
      >
      {/* 헤더 */}
      <header className="flex shrink-0 items-center justify-between px-6 pb-3 pt-5">
        <h1
          className="font-display text-[26px]"
          style={{ color: TANGERINE, letterSpacing: ".5px" }}
        >
          오늘의 코디
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="코디 구성 설정"
            className="flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm"
            style={{ borderColor: INK, color: INK, background: "#fff" }}
          >
            ⚙️
          </button>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border-2"
            style={{ borderColor: INK, color: INK }}
          >
            ✕
          </button>
        </div>
      </header>

      {/* 저장 / 룩북 */}
      <div className="flex shrink-0 gap-2 px-6 pb-2">
        <button
          onClick={openSave}
          disabled={chosen.length === 0}
          className="font-kr flex-1 rounded-full border-2 py-2 text-xs font-bold transition active:scale-95 disabled:opacity-40"
          style={{ borderColor: INK, color: INK, background: "#fff" }}
        >
          {savedFlash ? "✓ 룩북에 저장됐어요" : "💾 이 코디 저장"}
        </button>
        <button
          onClick={() => setLookbookOpen(true)}
          className="font-kr flex-1 rounded-full border-2 py-2 text-xs font-bold transition active:scale-95"
          style={{ borderColor: INK, color: INK, background: "#fff" }}
        >
          📚 룩북{lookbooks.length > 0 ? ` ${lookbooks.length}` : ""}
        </button>
      </div>

      {/* 코디 프리뷰 */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 px-6 py-2">
        {chosen.length === 0 ? (
          <p className="text-sm font-bold" style={{ color: MUTED }}>
            아래에서 상의·하의·신발을 골라보세요
          </p>
        ) : (
          <>
            {/* 아우터만 있고 상의가 없으면 단독 표시 */}
            {outer && !hasTop && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src(outer)}
                alt={outer.name ?? ""}
                className={outer.cutout_url ? "cutout" : ""}
                style={{
                  height: "27%",
                  maxHeight: 200,
                  width: "auto",
                  maxWidth: "72%",
                  objectFit: "contain",
                }}
              />
            )}
            {stack.map((i) =>
              i.category === "top" && outer ? (
                // 상의 + 아우터(뒤에 살짝 겹침)
                <div
                  key={i.id}
                  className="relative flex items-center justify-center"
                  style={{ height: "27%", maxHeight: 200 }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src(outer)}
                    alt={outer.name ?? ""}
                    className={outer.cutout_url ? "cutout" : ""}
                    style={{
                      position: "absolute",
                      height: "100%",
                      width: "auto",
                      maxWidth: "80%",
                      objectFit: "contain",
                      transform: "translate(-24%, -3%) rotate(-7deg)",
                      zIndex: 0,
                    }}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src(i)}
                    alt={i.name ?? ""}
                    className={i.cutout_url ? "cutout" : ""}
                    style={{
                      position: "relative",
                      height: "100%",
                      width: "auto",
                      maxWidth: "72%",
                      objectFit: "contain",
                      zIndex: 1,
                    }}
                  />
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i.id}
                  src={src(i)}
                  alt={i.name ?? ""}
                  className={i.cutout_url ? "cutout" : ""}
                  style={{
                    height: smallCat(i.category) ? "15%" : "27%",
                    maxHeight: smallCat(i.category) ? 90 : 200,
                    width: "auto",
                    maxWidth: "72%",
                    objectFit: "contain",
                  }}
                />
              ),
            )}
          </>
        )}
      </div>

      {/* 랜덤 추천 (하단 주요 버튼) */}
      <div className="shrink-0 px-4 pb-2">
        <button
          onClick={() => setSel(randomPick())}
          className="font-kr w-full rounded-2xl border-2 py-3.5 text-sm font-bold text-white transition active:scale-[.98]"
          style={{
            background: TANGERINE,
            borderColor: INK,
            boxShadow: "0 10px 22px -8px rgba(255,106,61,.6)",
          }}
        >
          🎲 랜덤 코디 추천
        </button>
      </div>

      {/* 카테고리별 선택 (직접 조합) */}
      <div
        className="no-scrollbar shrink-0 space-y-3 overflow-y-auto border-t-2 bg-white px-4 pb-8 pt-3"
        style={{ borderColor: INK, maxHeight: "42dvh" }}
      >
        <p
          className="text-[11px] font-bold uppercase tracking-wider"
          style={{ color: MUTED }}
        >
          아래에서 직접 골라 조합할 수도 있어요
        </p>
        {cats.map((c) => (
          <div key={c.id}>
            <p
              className="mb-1.5 text-[11px] font-bold uppercase tracking-wider"
              style={{ color: MUTED }}
            >
              {c.emoji} {c.label}
              {OPTIONAL.has(c.id) && (
                <span className="ml-1 normal-case" style={{ color: LINE }}>
                  (선택)
                </span>
              )}
            </p>
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {items
                .filter((i) => i.category === c.id)
                .map((i) => {
                  const active = sel[c.id] === i.id;
                  return (
                    <button
                      key={i.id}
                      onClick={() => toggle(c.id, i.id)}
                      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border-2 p-1"
                      style={{
                        borderColor: active ? TANGERINE : LINE,
                        background: active ? "#FFF1EA" : "#FFF6F0",
                        borderWidth: active ? 3 : 2,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src(i)}
                        alt={i.name ?? ""}
                        className="max-h-full max-w-full object-contain"
                      />
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      {/* 코디 구성 카테고리 설정 팝업 */}
      {settingsOpen && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center px-8"
          style={{ background: "rgba(20,15,40,.55)" }}
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="w-full max-w-xs rounded-3xl border-2 bg-white p-5"
            style={{ borderColor: INK, boxShadow: "0 18px 40px -12px rgba(0,0,0,.4)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-kr text-lg font-bold" style={{ color: INK }}>
              코디에 넣을 카테고리
            </p>
            <p className="mt-1 text-xs" style={{ color: MUTED }}>
              랜덤 코디에 어떤 옷을 조합할지 골라요
            </p>
            <div className="no-scrollbar mt-3 max-h-[46dvh] space-y-1.5 overflow-y-auto">
              {categories.map((c) => {
                const on = coordiCats.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleCat(c.id)}
                    className="flex w-full items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-bold transition active:scale-[.98]"
                    style={
                      on
                        ? { borderColor: INK, background: "#FFF6F0", color: INK }
                        : { borderColor: LINE, background: "#fff", color: MUTED }
                    }
                  >
                    <span>{c.emoji}</span>
                    <span className="flex-1 text-left">{c.label}</span>
                    <span style={{ color: TANGERINE }}>{on ? "✓" : ""}</span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setSettingsOpen(false)}
              className="font-kr mt-4 w-full rounded-2xl border-2 py-3 text-sm font-bold text-white"
              style={{ background: TANGERINE, borderColor: INK }}
            >
              완료
            </button>
          </div>
        </div>
      )}

      {/* 코디 저장 (이름 지정) */}
      {saveOpen && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center px-8"
          style={{ background: "rgba(20,15,40,.55)" }}
          onClick={() => setSaveOpen(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              doSave();
            }}
            className="w-full max-w-xs rounded-3xl border-2 bg-white p-5"
            style={{ borderColor: INK, boxShadow: "0 18px 40px -12px rgba(0,0,0,.4)" }}
          >
            <p className="font-kr text-lg font-bold" style={{ color: INK }}>
              이 코디 저장
            </p>
            <input
              autoFocus
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="코디 이름 (예: 데일리룩)"
              className="mt-3 w-full rounded-2xl border-2 px-4 py-3 text-sm outline-none"
              style={{ borderColor: LINE, color: INK }}
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setSaveOpen(false)}
                className="font-kr flex-1 rounded-2xl border-2 py-3 text-sm font-bold"
                style={{ borderColor: LINE, color: MUTED }}
              >
                취소
              </button>
              <button
                type="submit"
                className="font-kr flex-1 rounded-2xl border-2 py-3 text-sm font-bold text-white"
                style={{ background: TANGERINE, borderColor: INK }}
              >
                저장
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 룩북 목록 */}
      {lookbookOpen && (
        <div className="absolute inset-0 z-20 flex flex-col bg-white">
          <header className="flex shrink-0 items-center justify-between px-6 pb-3 pt-5">
            <h2
              className="font-display text-[22px]"
              style={{ color: TANGERINE, letterSpacing: ".5px" }}
            >
              내 룩북
            </h2>
            <button
              onClick={() => setLookbookOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-full border-2"
              style={{ borderColor: INK, color: INK }}
            >
              ✕
            </button>
          </header>
          <div className="no-scrollbar flex-1 space-y-3 overflow-y-auto px-6 pb-10">
            {lookbooks.length === 0 ? (
              <p
                className="py-16 text-center text-sm font-bold"
                style={{ color: MUTED }}
              >
                아직 저장한 코디가 없어요.
                <br />
                마음에 드는 코디에서 💾 저장을 눌러보세요.
              </p>
            ) : (
              lookbooks.map((lb) => {
                const lbItems = lb.item_ids
                  .map((id) => items.find((i) => i.id === id))
                  .filter((i): i is Clothing => !!i);
                return (
                  <div
                    key={lb.id}
                    className="rounded-2xl border-2 p-3"
                    style={{ borderColor: LINE, background: "#FFF6F0" }}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span
                        className="text-sm font-bold"
                        style={{ color: INK }}
                      >
                        {lb.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => loadLookbook(lb)}
                          className="rounded-full border-2 px-3 py-1 text-xs font-bold text-white"
                          style={{ background: TANGERINE, borderColor: INK }}
                        >
                          입어보기
                        </button>
                        <button
                          onClick={() => removeLookbook(lb.id)}
                          className="text-xs font-bold"
                          style={{ color: "#C63F1E" }}
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {lbItems.map((it) => (
                        <div
                          key={it.id}
                          className="flex h-14 w-14 items-center justify-center rounded-xl border bg-white"
                          style={{ borderColor: LINE }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={src(it)}
                            alt=""
                            className="max-h-[85%] max-w-[85%] object-contain"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
