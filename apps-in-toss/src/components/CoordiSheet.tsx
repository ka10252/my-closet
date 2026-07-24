"use client";

import { useEffect, useMemo, useState } from "react";
import type { Clothing, EffectiveCategory } from "@/lib/categories";

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

  function toggle(catId: string, itemId: string) {
    setSel((s) => ({ ...s, [catId]: s[catId] === itemId ? null : itemId }));
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
            onClick={() => setSel(randomPick())}
            className="font-kr rounded-full border-2 px-4 py-1.5 text-xs font-bold text-white"
            style={{ background: TANGERINE, borderColor: INK }}
          >
            🎲 랜덤
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

      {/* 코디 프리뷰 */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 px-6 py-2">
        {chosen.length === 0 ? (
          <p className="text-sm font-bold" style={{ color: MUTED }}>
            아래에서 상의·하의·신발을 골라보세요
          </p>
        ) : (
          chosen.map((i) => (
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
          ))
        )}
      </div>

      {/* 카테고리별 선택 */}
      <div
        className="no-scrollbar shrink-0 space-y-3 overflow-y-auto border-t-2 bg-white px-4 pb-8 pt-4"
        style={{ borderColor: INK, maxHeight: "44dvh" }}
      >
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
      </div>
    </div>
  );
}
