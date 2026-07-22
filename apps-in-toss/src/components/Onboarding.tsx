import { useState } from "react";

const TANGERINE = "#FF6A3D";
const INK = "#2A1206";

export const ONBOARD_KEY = "mycloset_onboarded_v1";

interface Slide {
  emoji: string;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    emoji: "👕",
    title: "나만의 옷장에 오신 걸 환영해요",
    body: "내 옷을 사진 찍어 스티커처럼 모아두는 옷장이에요. 뭘 가졌는지 한눈에 보고, 여행 짐도 쉽게 챙겨요.",
  },
  {
    emoji: "📷",
    title: "사진만 고르면 끝",
    body: "옷 사진을 고르면 배경을 자동으로 지워(누끼) 예쁜 스티커로 만들어줘요. 여러 장을 한 번에 담을 수도 있어요.",
  },
  {
    emoji: "🗂️",
    title: "선반으로 정리하기",
    body: "상의·하의처럼 선반(카테고리)으로 나눠 걸고, ⭐로 아끼는 옷을 즐겨찾기 해요. 세부 분류도 만들 수 있어요.",
  },
  {
    emoji: "🧳",
    title: "패킹 & 코디",
    body: "🧳 패킹 모드로 여행 짐을 하나씩 체크하고, 🎽 코디로 오늘 뭐 입을지 랜덤 추천도 받아보세요.",
  },
];

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const last = i === SLIDES.length - 1;
  const s = SLIDES[i];

  function finish() {
    try {
      localStorage.setItem(ONBOARD_KEY, "1");
    } catch {
      // localStorage 사용 불가해도 진행
    }
    onDone();
  }

  return (
    <div
      className="fixed inset-0 z-[70] mx-auto flex max-w-md flex-col items-center justify-between px-8 py-14 text-center"
      style={{
        background: TANGERINE,
        backgroundImage:
          "radial-gradient(rgba(255,255,255,.16) 1.8px, transparent 1.8px)",
        backgroundSize: "22px 22px",
      }}
    >
      <button
        onClick={finish}
        className="self-end text-xs font-bold uppercase tracking-wider"
        style={{ color: "#FFE3D6" }}
      >
        건너뛰기
      </button>

      <div className="flex flex-col items-center gap-5">
        <div
          className="flex h-28 w-28 items-center justify-center rounded-[28px] border-2 text-6xl"
          style={{ background: "#FFF6F0", borderColor: INK }}
        >
          {s.emoji}
        </div>
        <h2
          className="font-kr text-2xl font-bold leading-snug text-white"
          style={{ textShadow: `2px 2px 0 ${INK}` }}
        >
          {s.title}
        </h2>
        <p
          className="max-w-xs text-sm font-medium leading-relaxed"
          style={{ color: "#FFF1EA" }}
        >
          {s.body}
        </p>
      </div>

      <div className="flex w-full flex-col items-center gap-5">
        {/* 진행 점 */}
        <div className="flex gap-2">
          {SLIDES.map((_, idx) => (
            <span
              key={idx}
              className="h-2 rounded-full transition-all"
              style={{
                width: idx === i ? 22 : 8,
                background: idx === i ? INK : "rgba(42,18,6,.35)",
              }}
            />
          ))}
        </div>

        <button
          onClick={() => (last ? finish() : setI(i + 1))}
          className="font-kr w-full max-w-xs rounded-2xl border-2 py-3.5 text-base font-bold text-white transition active:scale-[.97]"
          style={{
            background: INK,
            borderColor: INK,
            boxShadow: "0 12px 26px -8px rgba(0,0,0,.3)",
          }}
        >
          {last ? "옷장 열기 ✿" : "다음"}
        </button>
      </div>
    </div>
  );
}
