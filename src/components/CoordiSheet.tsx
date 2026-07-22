"use client";

import { useMemo, useState } from "react";
import type { Clothing, EffectiveCategory } from "@/lib/categories";

const TANGERINE = "#FF6A3D";
const INK = "#2A1206";
const MUTED = "#B0846A";
const LINE = "#F3C9B4";

const src = (i: Clothing) => i.cutout_url ?? i.image_url;

// 코디 구성: 아우터(최상단·옵션) → 상의 → 하의 → 신발 만
const COORDI = ["outerwear", "top", "bottom", "shoes"] as const;
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
  // 코디 대상 카테고리(존재 + 옷 보유)만, 정해진 순서대로
  const cats = useMemo(
    () =>
      COORDI.map((id) => categories.find((c) => c.id === id)).filter(
        (c): c is EffectiveCategory =>
          !!c && items.some((i) => i.category === c.id),
      ),
    [categories, items],
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

  // cats 는 이미 아우터→상의→하의→신발 순서
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
    <div
      className="fixed inset-0 z-50 flex flex-col"
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
    </div>
  );
}
