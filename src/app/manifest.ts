import type { MetadataRoute } from "next";

// PWA 매니페스트 — 폰 홈화면에 앱처럼 설치 가능하게
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "나만의 옷장",
    short_name: "옷장",
    description: "내 옷을 스티커처럼 모아 관리하는 옷장",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      // TODO: public/icon-192.png, public/icon-512.png 로 실제 아이콘 교체
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
