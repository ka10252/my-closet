import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 홈 디렉토리에 다른 lockfile이 있어서 루트를 이 프로젝트로 고정
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
