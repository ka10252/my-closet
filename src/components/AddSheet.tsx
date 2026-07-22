"use client";

import { useEffect, useRef, useState } from "react";
import { addClothing } from "@/lib/clothes";
import type { Clothing, EffectiveCategory } from "@/lib/categories";

const TANGERINE = "#FF6A3D";
const INK = "#2A1206";
const MUTED = "#B0846A";
const LINE = "#F3C9B4";

type Phase = "pick" | "processing" | "review" | "saving";

interface Entry {
  id: string;
  cutout: Blob;
  sticker: Blob;
  url: string;
  name: string;
  category: string;
}

export default function AddSheet({
  categories,
  onClose,
  onAddedMany,
}: {
  categories: EffectiveCategory[];
  onClose: () => void;
  onAddedMany: (items: Clothing[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("pick");
  const [progressText, setProgressText] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState("");
  const defaultCat = categories[0]?.id ?? "top";
  const busy = phase === "processing" || phase === "saving";

  // 추가 화면 열자마자 누끼 모델을 백그라운드로 미리 받아둠 → 첫 누끼가 빨라짐
  useEffect(() => {
    import("@/lib/sticker").then((m) => m.preloadSticker()).catch(() => {});
  }, []);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = "";
    setError("");
    setPhase("processing");
    try {
      const { makeSticker } = await import("@/lib/sticker");
      const made: Entry[] = [];
      for (let i = 0; i < files.length; i++) {
        setProgressText(`${i + 1} / ${files.length}장 배경 지우는 중…`);
        const { cutout, sticker } = await makeSticker(files[i], {
          onProgress: (p, ratio) => {
            const pct = Math.round(ratio * 100);
            setProgressText(
              p === "download"
                ? `누끼 엔진 준비 중… ${pct}%`
                : `${i + 1} / ${files.length}장 배경 지우는 중… ${pct}%`,
            );
          },
        });
        made.push({
          id: crypto.randomUUID(),
          cutout,
          sticker,
          url: URL.createObjectURL(cutout),
          name: "",
          category: defaultCat,
        });
      }
      setEntries((prev) => [...prev, ...made]);
      setPhase("review");
    } catch (err) {
      console.error(err);
      setError("이미지 처리에 실패했어요. 다른 사진으로 다시 시도해 주세요.");
      setPhase(entries.length ? "review" : "pick");
    }
  }

  function updateEntry(id: string, patch: Partial<Entry>) {
    setEntries((prev) =>
      prev.map((en) => (en.id === id ? { ...en, ...patch } : en)),
    );
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((en) => en.id !== id));
  }

  async function handleSaveAll() {
    if (!entries.length) return;
    setPhase("saving");
    setError("");
    try {
      // 업로드는 서로 독립적이라 병렬로 → 여러 벌 저장이 훨씬 빠름
      const saved = await Promise.all(
        entries.map((en) =>
          addClothing({
            sticker: en.sticker,
            cutout: en.cutout,
            category: en.category,
            name: en.name,
          }),
        ),
      );
      onAddedMany(saved);
    } catch (err) {
      console.error(err);
      setError("저장에 실패했어요. 네트워크를 확인해 주세요.");
      setPhase("review");
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
          className="mx-auto mb-4 h-1.5 w-11 rounded-full"
          style={{ background: LINE }}
        />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold" style={{ color: INK }}>
            옷 추가{entries.length ? ` · ${entries.length}장` : ""}
          </h2>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="flex h-8 w-8 items-center justify-center rounded-full border"
            style={{ borderColor: LINE, color: MUTED }}
          >
            ✕
          </button>
        </div>

        {error && (
          <p
            className="mb-3 rounded-xl px-3 py-2 text-sm font-medium"
            style={{ background: "#FFECE4", color: "#C63F1E" }}
          >
            {error}
          </p>
        )}

        {busy ? (
          <div
            className="flex flex-col items-center justify-center gap-4 rounded-[22px] border-2"
            style={{ aspectRatio: "1.35", background: "#FFF6F0", borderColor: INK }}
          >
            <div
              className="h-11 w-11 animate-spin rounded-full border-[5px]"
              style={{ borderColor: "#FADFD1", borderTopColor: TANGERINE }}
            />
            <span className="text-sm font-bold" style={{ color: INK }}>
              {phase === "saving" ? "저장 중…" : progressText || "처리 중…"}
            </span>
          </div>
        ) : entries.length === 0 ? (
          <button
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-3 rounded-[22px] border-[2.5px] border-dashed transition active:scale-[.98]"
            style={{
              aspectRatio: "1.35",
              borderColor: TANGERINE,
              background: "#FFF6F0",
              color: MUTED,
            }}
          >
            <span className="text-5xl">📷</span>
            <span className="text-base font-bold" style={{ color: INK }}>
              사진 선택 / 촬영
            </span>
            <span className="text-xs font-semibold">
              여러 장 한번에 · 배경 자동 제거 ✨
            </span>
          </button>
        ) : (
          <div className="no-scrollbar -mx-1 flex-1 space-y-2.5 overflow-y-auto px-1">
            {entries.map((en) => (
              <div
                key={en.id}
                className="flex gap-3 rounded-2xl border-2 p-2.5"
                style={{ borderColor: LINE, background: "#FFF6F0" }}
              >
                <div
                  className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border bg-white"
                  style={{ borderColor: LINE }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={en.url}
                    alt=""
                    className="cutout max-h-[80%] max-w-[80%] object-contain"
                  />
                </div>
                <div className="flex flex-1 flex-col justify-center gap-2">
                  <input
                    value={en.name}
                    onChange={(e) =>
                      updateEntry(en.id, { name: e.target.value })
                    }
                    placeholder="이름 (선택)"
                    className="w-full rounded-lg border-2 bg-white px-2.5 py-1.5 text-sm outline-none"
                    style={{ borderColor: LINE, color: INK }}
                  />
                  <div className="flex items-center gap-2">
                    <select
                      value={en.category}
                      onChange={(e) =>
                        updateEntry(en.id, { category: e.target.value })
                      }
                      className="flex-1 rounded-lg border-2 bg-white px-2 py-1.5 text-sm outline-none"
                      style={{ borderColor: LINE, color: INK }}
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.emoji} {c.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeEntry(en.id)}
                      className="rounded-lg px-2 py-1.5 text-xs font-bold"
                      style={{ color: "#C63F1E" }}
                    >
                      제거
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFiles}
        />

        {phase === "review" && entries.length > 0 && (
          <div className="mt-4 flex gap-2.5">
            <button
              onClick={() => fileRef.current?.click()}
              className="font-kr flex-1 rounded-2xl border-2 py-3.5 text-sm font-bold transition active:scale-[.98]"
              style={{ borderColor: INK, color: INK }}
            >
              사진 더 추가
            </button>
            <button
              onClick={handleSaveAll}
              className="font-kr flex-[2] rounded-2xl border-2 py-3.5 text-sm font-bold text-white transition active:scale-[.98]"
              style={{
                background: TANGERINE,
                borderColor: INK,
                boxShadow: "0 10px 22px -8px rgba(255,106,61,.6)",
              }}
            >
              {entries.length}벌 옷장에 담기 ✿
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
