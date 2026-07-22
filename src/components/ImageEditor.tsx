"use client";

import { useEffect, useRef, useState } from "react";

// 누끼 편집기: 지우개(배경 잔여물 지우기) / 복원(잘못 지워진 부분 되살리기) 브러시
// 결과는 테두리 없는 투명 PNG(cutout)로 반환됨.

const MAX_DIM = 1200; // 편집 캔버스 최대 해상도

const TANGERINE = "#FF6A3D";
const INK = "#2A1206";
const MUTED = "#B0846A";
const LINE = "#F3C9B4";

// 크롭 영역(캔버스 대비 0~1 비율)
interface Crop {
  l: number;
  t: number;
  r: number;
  b: number;
}
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export default function ImageEditor({
  src,
  title = "누끼 편집",
  onCancel,
  onSave,
}: {
  src: string;
  title?: string;
  onCancel: () => void;
  onSave: (edited: Blob) => void | Promise<void>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalRef = useRef<HTMLCanvasElement | null>(null); // 복원 소스
  const historyRef = useRef<ImageData[]>([]);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<"erase" | "restore" | "crop">("erase");
  const [brush, setBrush] = useState(36);
  const [crop, setCrop] = useState<Crop>({ l: 0, t: 0, r: 1, b: 1 });
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    function draw(img: HTMLImageElement) {
      if (cancelled) return;
      const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = canvasRef.current!;
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);

      const orig = document.createElement("canvas");
      orig.width = w;
      orig.height = h;
      orig.getContext("2d")!.drawImage(img, 0, 0, w, h);
      originalRef.current = orig;

      historyRef.current = [];
      setCrop({ l: 0, t: 0, r: 1, b: 1 });
      setReady(true);
    }

    // 원격 이미지를 blob으로 먼저 받아 same-origin(blob:) 으로 그림 → 캔버스 taint 방지
    (async () => {
      try {
        const res = await fetch(src, { mode: "cors" });
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => draw(img);
        img.onerror = () => setLoadError(true);
        img.src = objectUrl;
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  function pushHistory() {
    const ctx = canvasRef.current!.getContext("2d")!;
    const snap = ctx.getImageData(
      0,
      0,
      canvasRef.current!.width,
      canvasRef.current!.height,
    );
    historyRef.current.push(snap);
    if (historyRef.current.length > 12) historyRef.current.shift();
  }

  function undo() {
    const snap = historyRef.current.pop();
    if (!snap) return;
    canvasRef.current!.getContext("2d")!.putImageData(snap, 0, 0);
  }

  function pos(e: React.PointerEvent): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function stamp(x: number, y: number) {
    const ctx = canvasRef.current!.getContext("2d")!;
    const r = (brush / 2) * (canvasRef.current!.width / (canvasRef.current!.getBoundingClientRect().width || 1));
    if (mode === "erase") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 복원: 원본에서 해당 영역을 다시 그림 (원형 클립)
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(originalRef.current!, 0, 0);
      ctx.restore();
    }
  }

  function line(a: { x: number; y: number }, b: { x: number; y: number }) {
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.floor(dist / 4));
    for (let i = 0; i <= steps; i++) {
      stamp(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps);
    }
  }

  function onDown(e: React.PointerEvent) {
    if (!ready || mode === "crop") return; // 크롭은 오버레이가 처리
    e.currentTarget.setPointerCapture(e.pointerId);
    pushHistory();
    drawingRef.current = true;
    const p = pos(e);
    lastRef.current = p;
    stamp(p.x, p.y);
  }

  // ---- 크롭 오버레이 조작 (window 레벨 드래그로 안정적 추적) ----
  function cropDown(e: React.PointerEvent, handle: string) {
    e.stopPropagation();
    e.preventDefault();
    const rect = overlayRef.current!.getBoundingClientRect();
    const start = { ...crop };
    const startX = (e.clientX - rect.left) / rect.width;
    const startY = (e.clientY - rect.top) / rect.height;
    const MIN = 0.12;

    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - rect.left) / rect.width - startX;
      const dy = (ev.clientY - rect.top) / rect.height - startY;
      let { l, t, r, b } = start;
      if (handle === "move") {
        const w = r - l;
        const h = b - t;
        l = clamp01(Math.min(Math.max(l + dx, 0), 1 - w));
        t = clamp01(Math.min(Math.max(t + dy, 0), 1 - h));
        r = l + w;
        b = t + h;
      } else {
        if (handle.includes("l")) l = Math.min(Math.max(0, l + dx), r - MIN);
        if (handle.includes("r")) r = Math.max(Math.min(1, r + dx), l + MIN);
        if (handle.includes("t")) t = Math.min(Math.max(0, t + dy), b - MIN);
        if (handle.includes("b")) b = Math.max(Math.min(1, b + dy), t + MIN);
      }
      setCrop({ l, t, r, b });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  function onMove(e: React.PointerEvent) {
    if (!drawingRef.current) return;
    const p = pos(e);
    if (lastRef.current) line(lastRef.current, p);
    lastRef.current = p;
  }

  function onUp() {
    drawingRef.current = false;
    lastRef.current = null;
  }

  async function handleSave() {
    setSaving(true);
    const canvas = canvasRef.current!;
    let out: HTMLCanvasElement = canvas;
    const { l, t, r, b } = crop;
    // 크롭 영역이 전체가 아니면 잘라서 출력
    if (l > 0.002 || t > 0.002 || r < 0.998 || b < 0.998) {
      const W = canvas.width;
      const H = canvas.height;
      const sx = Math.round(l * W);
      const sy = Math.round(t * H);
      const sw = Math.max(1, Math.round((r - l) * W));
      const sh = Math.max(1, Math.round((b - t) * H));
      const c = document.createElement("canvas");
      c.width = sw;
      c.height = sh;
      c.getContext("2d")!.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
      out = c;
    }
    out.toBlob(async (blob) => {
      if (blob) await onSave(blob);
      setSaving(false);
    }, "image/png");
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      style={{ background: "rgba(20,15,40,.5)" }}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-[28px] border-t-2 bg-white p-6 pb-9"
        style={{ borderColor: INK }}
      >
        <div
          className="mx-auto mb-4 h-1.5 w-11 rounded-full"
          style={{ background: LINE }}
        />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold" style={{ color: INK }}>
            {title}
          </h2>
          <button
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-full border"
            style={{ borderColor: LINE, color: MUTED }}
          >
            ✕
          </button>
        </div>

        {loadError ? (
          <p
            className="py-16 text-center text-sm font-medium"
            style={{ color: "#C63F1E" }}
          >
            이미지를 불러오지 못했어요.
          </p>
        ) : (
          <>
            <p
              className="mb-2 text-[10.5px] font-bold uppercase tracking-wider"
              style={{ color: MUTED }}
            >
              {mode === "crop"
                ? "✂️ 모서리를 끌어 자를 영역을 정하세요"
                : "🧽 잔여 배경 지우기 · ↩️ 잘린 부분 복원"}
            </p>
            {/* 체커보드 배경 위 캔버스 */}
            <div
              className="mb-3 flex items-center justify-center rounded-2xl border-2 p-2"
              style={{
                borderColor: INK,
                background:
                  "repeating-conic-gradient(#f3c9b4 0% 25%, #fff6f0 0% 50%) 50% / 20px 20px",
              }}
            >
              <div className="relative">
                <canvas
                  ref={canvasRef}
                  onPointerDown={onDown}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerLeave={onUp}
                  className="block max-h-[46dvh] w-auto max-w-full touch-none rounded-lg"
                  style={{ cursor: mode === "crop" ? "default" : "crosshair" }}
                />
                {mode === "crop" && (
                  <div ref={overlayRef} className="absolute inset-0 touch-none">
                    {/* 바깥 영역 어둡게 (4패널 — 핸들을 가리지 않음) */}
                    {(
                      [
                        { left: 0, top: 0, width: "100%", height: `${crop.t * 100}%` },
                        {
                          left: 0,
                          top: `${crop.b * 100}%`,
                          width: "100%",
                          height: `${(1 - crop.b) * 100}%`,
                        },
                        {
                          left: 0,
                          top: `${crop.t * 100}%`,
                          width: `${crop.l * 100}%`,
                          height: `${(crop.b - crop.t) * 100}%`,
                        },
                        {
                          left: `${crop.r * 100}%`,
                          top: `${crop.t * 100}%`,
                          width: `${(1 - crop.r) * 100}%`,
                          height: `${(crop.b - crop.t) * 100}%`,
                        },
                      ] as const
                    ).map((s, i) => (
                      <div
                        key={i}
                        style={{
                          position: "absolute",
                          background: "rgba(0,0,0,.45)",
                          pointerEvents: "none",
                          ...s,
                        }}
                      />
                    ))}

                    {/* 크롭 박스 (테두리 + 이동) */}
                    <div
                      onPointerDown={(e) => cropDown(e, "move")}
                      style={{
                        position: "absolute",
                        left: `${crop.l * 100}%`,
                        top: `${crop.t * 100}%`,
                        width: `${(crop.r - crop.l) * 100}%`,
                        height: `${(crop.b - crop.t) * 100}%`,
                        border: `2px solid ${TANGERINE}`,
                        boxShadow: `0 0 0 1px ${INK}`,
                        cursor: "move",
                        touchAction: "none",
                      }}
                    />

                    {/* 모서리 핸들 (큰 투명 터치 영역 + 작은 시각 핸들) */}
                    {(
                      [
                        { h: "tl", x: crop.l, y: crop.t },
                        { h: "tr", x: crop.r, y: crop.t },
                        { h: "bl", x: crop.l, y: crop.b },
                        { h: "br", x: crop.r, y: crop.b },
                      ] as const
                    ).map(({ h, x, y }) => (
                      <div
                        key={h}
                        onPointerDown={(e) => cropDown(e, h)}
                        style={{
                          position: "absolute",
                          left: `${x * 100}%`,
                          top: `${y * 100}%`,
                          width: 46,
                          height: 46,
                          transform: "translate(-50%,-50%)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          touchAction: "none",
                          cursor: "nwse-resize",
                          zIndex: 2,
                        }}
                      >
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            background: TANGERINE,
                            border: `3px solid ${INK}`,
                            borderRadius: 7,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 컨트롤 */}
            <div className="mb-3 flex items-center gap-2">
              <button
                onClick={() => setMode("erase")}
                className="flex-1 rounded-xl border-2 py-2.5 text-sm font-bold transition"
                style={
                  mode === "erase"
                    ? { background: TANGERINE, color: "#FFF6F0", borderColor: INK }
                    : { background: "transparent", color: MUTED, borderColor: LINE }
                }
              >
                🧽 지우개
              </button>
              <button
                onClick={() => setMode("restore")}
                className="flex-1 rounded-xl border-2 py-2.5 text-sm font-bold transition"
                style={
                  mode === "restore"
                    ? { background: TANGERINE, color: "#FFF6F0", borderColor: INK }
                    : { background: "transparent", color: MUTED, borderColor: LINE }
                }
              >
                ↩️ 복원
              </button>
              <button
                onClick={() => setMode("crop")}
                className="flex-1 rounded-xl border-2 py-2.5 text-sm font-bold transition"
                style={
                  mode === "crop"
                    ? { background: TANGERINE, color: "#FFF6F0", borderColor: INK }
                    : { background: "transparent", color: MUTED, borderColor: LINE }
                }
              >
                ✂️ 크롭
              </button>
            </div>

            {mode === "crop" ? (
              <div className="mb-4 flex items-center justify-between">
                <span
                  className="text-[10.5px] font-bold uppercase tracking-wider"
                  style={{ color: MUTED }}
                >
                  자를 영역
                </span>
                <button
                  onClick={() => setCrop({ l: 0, t: 0, r: 1, b: 1 })}
                  className="rounded-full border-2 px-3 py-1.5 text-[11px] font-bold uppercase"
                  style={{ borderColor: LINE, color: MUTED }}
                >
                  전체로 리셋
                </button>
              </div>
            ) : (
              <div className="mb-4 flex items-center gap-3">
                <span
                  className="text-[10.5px] font-bold uppercase tracking-wider"
                  style={{ color: MUTED }}
                >
                  브러시
                </span>
                <input
                  type="range"
                  min={8}
                  max={90}
                  value={brush}
                  onChange={(e) => setBrush(Number(e.target.value))}
                  className="flex-1"
                  style={{ accentColor: TANGERINE }}
                />
                <span
                  className="w-8 text-right text-xs font-bold"
                  style={{ color: INK }}
                >
                  {brush}
                </span>
                <button
                  onClick={undo}
                  className="rounded-xl border-2 px-3 py-2 text-xs font-bold"
                  style={{ borderColor: LINE, color: INK }}
                >
                  되돌리기
                </button>
              </div>
            )}

            <div className="flex gap-2.5">
              <button
                onClick={onCancel}
                className="font-kr flex-1 rounded-2xl border-2 py-3.5 text-sm font-bold transition active:scale-[.98]"
                style={{ borderColor: INK, color: INK }}
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={!ready || saving}
                className="font-kr flex-[2] rounded-2xl border-2 py-3.5 text-sm font-bold text-white transition active:scale-[.98] disabled:opacity-50"
                style={{
                  background: TANGERINE,
                  borderColor: INK,
                  boxShadow: "0 10px 22px -8px rgba(255,106,61,.6)",
                }}
              >
                {saving ? "저장 중…" : "편집 완료"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
