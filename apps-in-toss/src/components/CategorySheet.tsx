"use client";

import { useState } from "react";
import type { EffectiveCategory, Subcategory } from "@/lib/categories";

const TANGERINE = "#FF6A3D";
const INK = "#2A1206";
const MUTED = "#B0846A";
const LINE = "#F3C9B4";

const EMOJI_PRESETS = ["🏷️", "👗", "🧦", "🧤", "🩳", "👔", "🥾", "🎒", "🕶️", "💍"];

export default function CategorySheet({
  categories,
  subcats,
  catCounts,
  subCounts,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
  onAddSub,
  onRenameSub,
  onDeleteSub,
  onClose,
}: {
  categories: EffectiveCategory[];
  subcats: Subcategory[];
  catCounts: Record<string, number>;
  subCounts: Record<string, number>;
  onAddCategory: (label: string, emoji: string) => Promise<void> | void;
  onRenameCategory: (cat: EffectiveCategory, label: string) => void;
  onDeleteCategory: (cat: EffectiveCategory) => void;
  onAddSub: (parent: string, label: string) => void;
  onRenameSub: (sub: Subcategory, label: string) => void;
  onDeleteSub: (sub: Subcategory) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState("");
  const [emoji, setEmoji] = useState("🏷️");
  const [busy, setBusy] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || busy) return;
    setBusy(true);
    try {
      await onAddCategory(label.trim(), emoji);
      setLabel("");
      setEmoji("🏷️");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(20,15,40,.5)" }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-[28px] border-t-2 bg-white p-6 pb-9"
        style={{ borderColor: INK }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="mx-auto mb-4 h-1.5 w-11 shrink-0 rounded-full"
          style={{ background: LINE }}
        />
        <div className="mb-4 flex shrink-0 items-center justify-between">
          <h2 className="text-xl font-bold" style={{ color: INK }}>
            카테고리 편집
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border"
            style={{ borderColor: LINE, color: MUTED }}
          >
            ✕
          </button>
        </div>

        {/* 카테고리 목록 */}
        <div className="no-scrollbar mb-4 flex-1 space-y-3 overflow-y-auto">
          {categories.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl border-2 p-3"
              style={{ borderColor: LINE, background: "#FFF6F0" }}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{c.emoji}</span>
                {c.builtin ? (
                  <span
                    className="flex-1 text-sm font-bold"
                    style={{ color: INK }}
                  >
                    {c.label}
                    <span
                      className="ml-2 text-[10px] font-bold uppercase"
                      style={{ color: MUTED }}
                    >
                      기본
                    </span>
                  </span>
                ) : (
                  <input
                    defaultValue={c.label}
                    onBlur={(e) => onRenameCategory(c, e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border-2 bg-white px-2 py-1 text-sm font-bold outline-none"
                    style={{ borderColor: LINE, color: INK }}
                  />
                )}
                <span className="text-xs font-bold" style={{ color: MUTED }}>
                  {catCounts[c.id] ?? 0}벌
                </span>
                {!c.builtin && (
                  <button
                    onClick={() => onDeleteCategory(c)}
                    className="text-xs font-bold"
                    style={{ color: "#C63F1E" }}
                  >
                    삭제
                  </button>
                )}
              </div>

              {/* 세부 카테고리 */}
              <div className="mt-2 space-y-1.5 pl-6">
                {subcats
                  .filter((s) => s.parent === c.id)
                  .map((s) => (
                    <div key={s.id} className="flex items-center gap-2">
                      <span style={{ color: MUTED }}>↳</span>
                      <input
                        defaultValue={s.label}
                        onBlur={(e) => onRenameSub(s, e.target.value)}
                        className="min-w-0 flex-1 rounded-lg border-2 bg-white px-2 py-1 text-xs outline-none"
                        style={{ borderColor: LINE, color: INK }}
                      />
                      <span
                        className="text-[11px] font-bold"
                        style={{ color: MUTED }}
                      >
                        {subCounts[s.id] ?? 0}
                      </span>
                      <button
                        onClick={() => onDeleteSub(s)}
                        className="text-[11px] font-bold"
                        style={{ color: "#C63F1E" }}
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                <SubAdder onAdd={(v) => onAddSub(c.id, v)} />
              </div>
            </div>
          ))}
        </div>

        {/* 새 카테고리 추가 */}
        <form onSubmit={handleAdd} className="shrink-0 space-y-2">
          <p
            className="text-[10.5px] font-bold uppercase tracking-wider"
            style={{ color: MUTED }}
          >
            새 카테고리 추가
          </p>
          <div className="flex gap-2">
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value.slice(0, 2))}
              className="w-14 rounded-xl border-2 bg-white text-center text-lg outline-none"
              style={{ borderColor: LINE }}
              aria-label="이모지"
            />
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="예: 잠옷"
              className="flex-1 rounded-xl border-2 bg-white px-3 py-2 text-sm outline-none"
              style={{ borderColor: LINE, color: INK }}
            />
            <button
              type="submit"
              disabled={busy || !label.trim()}
              className="font-kr rounded-xl border-2 px-4 text-sm font-bold text-white disabled:opacity-40"
              style={{ background: TANGERINE, borderColor: INK }}
            >
              추가
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {EMOJI_PRESETS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className="rounded-lg border-2 px-2 py-1 text-lg"
                style={{
                  borderColor: emoji === e ? INK : "transparent",
                  background: "#FFF6F0",
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </form>
      </div>
    </div>
  );
}

function SubAdder({ onAdd }: { onAdd: (label: string) => void }) {
  const [v, setV] = useState("");
  function commit() {
    if (v.trim()) onAdd(v.trim());
    setV("");
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        (
          e.currentTarget.querySelector("input") as HTMLInputElement | null
        )?.blur();
      }}
      className="flex items-center gap-2"
    >
      <span style={{ color: LINE }}>＋</span>
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={commit}
        placeholder="세부 추가 (예: 반팔)"
        className="min-w-0 flex-1 rounded-lg border-2 border-dashed bg-white px-2 py-1 text-xs outline-none"
        style={{ borderColor: LINE, color: INK }}
      />
    </form>
  );
}
