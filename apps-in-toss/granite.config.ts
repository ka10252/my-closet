import { defineConfig } from "@apps-in-toss/web-framework/config";

// 앱인토스 미니앱 설정.
// ⚠️ appName 은 앱인토스 콘솔에 등록한 미니앱 이름과 반드시 동일해야 해요.
export default defineConfig({
  appName: "my-closet",
  brand: {
    displayName: "나만의 옷장",
    primaryColor: "#FF6A3D", // 앱 테마(탠저린)
    icon: "", // 콘솔에 업로드한 아이콘 URL
  },
  web: {
    host: "localhost",
    port: 5173,
    commands: {
      dev: "vite dev",
      build: "vite build",
    },
  },
  // 사진으로 옷 추가(누끼) 기능을 위해 사진/카메라 권한 사용
  permissions: [
    { name: "photos", access: "read" },
    { name: "camera", access: "access" },
  ],
  outdir: "dist",
});
