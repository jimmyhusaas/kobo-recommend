import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kobo Recommend",
  description: "下一本看什麼",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-Hant">
      <body className="min-h-screen bg-zinc-50 text-zinc-900">
        <header className="border-b border-zinc-200 bg-white">
          <nav className="max-w-3xl mx-auto px-4 py-4 flex gap-6 text-sm items-center">
            <span className="font-semibold">Kobo Recommend</span>
            <a href="/" className="hover:underline text-zinc-600">書單</a>
            <a href="/analysis" className="hover:underline text-zinc-600">分析</a>
            <a href="/recommend" className="hover:underline text-zinc-600">推薦</a>
            <a href="/history" className="hover:underline text-zinc-600">歷史</a>
          </nav>
        </header>
        <main className="max-w-3xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
