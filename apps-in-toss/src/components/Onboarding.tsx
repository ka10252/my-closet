import { useLayoutEffect, useState } from "react";

const TANGERINE = "#FF6A3D";
const INK = "#2A1206";
const MUTED = "#B0846A";
const LINE = "#F3C9B4";

export const ONBOARD_KEY = "mycloset_onboarded_v1";

// 실제 화면 위에서 진행하는 코치마크 투어.
// kind:"card" = 중앙 팝업 카드(긴 설명), kind:"spot" = 실제 버튼을 하이라이트해서 가리킴.
type Step =
  | { kind: "card"; emoji: string; title: string; body: string; cta?: string }
  | { kind: "spot"; target: string; emoji: string; title: string; body: string };

const STEPS: Step[] = [
  {
    kind: "card",
    emoji: "👕",
    title: "나만의 옷장에 오신 걸 환영해요",
    body: "내 옷을 사진 찍어\n스티커처럼 모아두는 옷장이에요.",
  },
  {
    kind: "card",
    emoji: "📷",
    title: "사진만 고르면 끝",
    body: "옷 사진을 고르면 배경을 자동으로 지워(누끼)\n예쁜 스티커로 만들어줘요.\n여러 장을 한 번에 담을 수도 있어요.",
  },
  {
    kind: "spot",
    target: "add",
    emoji: "＋",
    title: "옷 추가하기",
    body: "여기를 눌러\n사진으로 옷을 추가해요.",
  },
  {
    kind: "spot",
    target: "shelves",
    emoji: "🗂️",
    title: "선반으로 정리",
    body: "상의·하의처럼 선반으로 나눠 걸어요.\n세부 분류도 만들 수 있어요.",
  },
  {
    kind: "spot",
    target: "packing",
    emoji: "🧳",
    title: "패킹 모드",
    body: "여행 갈 때 눌러요.\n짐을 하나씩 체크하며 챙길 수 있어요.",
  },
  {
    kind: "spot",
    target: "coordi",
    emoji: "🎽",
    title: "코디",
    body: "오늘 뭐 입을지\n랜덤으로 추천받아요.",
  },
  {
    kind: "card",
    emoji: "✨",
    title: "이제 시작해볼까요?",
    body: "사진 한 장만 올려보세요.\n금방 옷장이 채워져요.",
    cta: "옷장 열기 ✿",
  },
];

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  // spot 단계에서 실제 버튼 위치 측정 (리사이즈/레이아웃 안정 후 재측정)
  useLayoutEffect(() => {
    if (step.kind !== "spot") {
      setRect(null);
      return;
    }
    const measure = () => {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      setRect(el ? (el.getBoundingClientRect() as DOMRect) : null);
    };
    measure();
    const t = setTimeout(measure, 80);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
    };
  }, [i, step]);

  function finish() {
    try {
      localStorage.setItem(ONBOARD_KEY, "1");
    } catch {
      // 저장 실패해도 진행
    }
    onDone();
  }
  const next = () => (last ? finish() : setI(i + 1));

  const spot = step.kind === "spot" && rect ? rect : null;
  const pad = 8;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const below = spot ? spot.top + spot.height / 2 < vh * 0.5 : true;

  const card = (
    <div
      className="mx-auto w-full max-w-xs rounded-3xl border-2 bg-white p-5"
      style={{ borderColor: INK, boxShadow: "0 18px 40px -12px rgba(0,0,0,.4)" }}
    >
      <div
        className="mb-2.5 flex h-12 w-12 items-center justify-center rounded-2xl border-2 text-2xl"
        style={{ background: "#FFF6F0", borderColor: INK }}
      >
        {step.emoji}
      </div>
      <p className="font-kr text-lg font-bold" style={{ color: INK }}>
        {step.title}
      </p>
      <p
        className="mt-1.5 whitespace-pre-line text-sm leading-relaxed"
        style={{ color: MUTED }}
      >
        {step.body}
      </p>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex gap-1.5">
          {STEPS.map((_, idx) => (
            <span
              key={idx}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: idx === i ? 16 : 6,
                background: idx === i ? TANGERINE : LINE,
              }}
            />
          ))}
        </div>
        <div className="flex items-center gap-3">
          {!last && (
            <button
              onClick={finish}
              className="text-xs font-bold"
              style={{ color: MUTED }}
            >
              건너뛰기
            </button>
          )}
          <button
            onClick={next}
            className="font-kr rounded-xl border-2 px-4 py-2 text-sm font-bold text-white transition active:scale-95"
            style={{ background: TANGERINE, borderColor: INK }}
          >
            {last
              ? step.kind === "card" && step.cta
                ? step.cta
                : "시작하기"
              : "다음"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[70]">
      {/* 딤 배경 (card 단계) / 클릭 차단 (spot 단계는 스포트라이트 그림자가 딤 역할) */}
      <div
        className="absolute inset-0"
        style={{ background: spot ? "transparent" : "rgba(20,15,40,.62)" }}
      />

      {/* 실제 버튼 하이라이트 */}
      {spot && (
        <div
          style={{
            position: "absolute",
            left: spot.left - pad,
            top: spot.top - pad,
            width: spot.width + pad * 2,
            height: spot.height + pad * 2,
            borderRadius: 16,
            boxShadow: "0 0 0 9999px rgba(20,15,40,.62)",
            border: `3px solid ${TANGERINE}`,
            pointerEvents: "none",
          }}
        />
      )}

      {/* 설명 카드 */}
      {step.kind === "card" || !spot ? (
        <div className="absolute inset-0 flex items-center justify-center px-6">
          {card}
        </div>
      ) : (
        <div
          className="absolute px-6"
          style={
            below
              ? { left: 0, right: 0, top: spot.top + spot.height + pad + 12 }
              : { left: 0, right: 0, bottom: vh - spot.top + pad + 12 }
          }
        >
          {card}
        </div>
      )}
    </div>
  );
}
