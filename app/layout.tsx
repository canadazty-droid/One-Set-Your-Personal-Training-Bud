import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./fitness-os.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://lianyixia-ai-workout.canadazty.chatgpt.site"),
  applicationName: "练一下 · ONE SET",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/app-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/app-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "练一下" },
  formatDetection: { telephone: false },
  title: "练一下 · ONE SET — 一键生成，马上开练",
  description: "让 AI 写入训练计划，在练一下 · ONE SET 中逐组执行并自动记录；动作扫描提供可观察的技术反馈。",
  openGraph: {
    title: "练一下 · ONE SET",
    description: "Plan with AI. Train with ONE SET. Your plan, sets, history, and form progress in one loop.",
    images: [{ url: "/og.png", width: 1733, height: 908, alt: "练一下 · ONE SET — Plan. Train. Progress." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "练一下 · ONE SET",
    description: "Plan with AI. Train with ONE SET. Your plan, sets, history, and form progress in one loop.",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
  themeColor: "#f3eee4",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
