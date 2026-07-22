import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "나만의 옷장",
  description: "내 옷을 스티커처럼 모아 관리하는 옷장",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "옷장", statusBarStyle: "default" },
};

export const viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* Bungee = 로고/버튼, Space Grotesk = 라틴 UI, Do Hyeon = 한글(K3) */}
        <link
          href="https://fonts.googleapis.com/css2?family=Bungee&family=Space+Grotesk:wght@400;500;600;700&family=Do+Hyeon&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
