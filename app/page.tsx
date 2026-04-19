"use client";
import { useState, useEffect } from "react";

type Book = {
  id: string;
  title: string;
  author: string | null;
  rating: string | null;
  exclude_from_analysis: boolean;
  created_at: string;
};

export default function Home() {
  const [text, setText] = useState("");
  const [books, setBooks] = useState<Book[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadBooks() {
    const res = await fetch("/api/books");
    const data = await res.json();
    setBooks(data.books || []);
  }

  useEffect(() => {
    loadBooks();
  }, []);

  async function deleteBook(id: string) {
    await fetch(`/api/books/${id}`, { method: "DELETE" });
    setBooks((prev) => prev.filter((b) => b.id !== id));
  }

  async function toggleExclude(id: string, current: boolean) {
    await fetch(`/api/books/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exclude_from_analysis: !current }),
    });
    setBooks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, exclude_from_analysis: !current } : b))
    );
  }

  async function submit() {
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.inserted !== undefined) {
      setText("");
      const parts = [];
      if (data.inserted > 0) parts.push(`匯入 ${data.inserted} 本`);
      if (data.skipped > 0) parts.push(`${data.skipped} 本已存在略過`);
      setMessage(parts.join("，") || data.message || "完成");
      loadBooks();
    } else {
      setMessage(data.error ?? "匯入失敗");
    }
  }

  function exportCSV() {
    const header = ["書名", "作者", "評價", "排除分析", "匯入時間"];
    const rows = books.map((b) => [
      b.title,
      b.author ?? "",
      b.rating ?? "",
      b.exclude_from_analysis ? "是" : "否",
      new Date(b.created_at).toLocaleDateString("zh-TW"),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `書單_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? books.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          (b.author?.toLowerCase().includes(q) ?? false)
      )
    : books;

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold mb-2">匯入書單</h1>
        <p className="text-sm text-zinc-600 mb-4">
          一行一本。支援格式：<code className="px-1 bg-zinc-100">書名</code>、
          <code className="px-1 bg-zinc-100">書名 — 作者</code>、或{" "}
          <code className="px-1 bg-zinc-100">書名 — 作者 — liked/neutral/disliked</code>
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`1. 底層邏輯\n2. 原子習慣 — James Clear — liked\n3. 快思慢想 — Daniel Kahneman`}
          className="w-full h-48 p-3 border border-zinc-300 rounded font-mono text-sm bg-white"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={submit}
            disabled={loading || !text.trim()}
            className="px-4 py-2 bg-zinc-900 text-white rounded disabled:opacity-40"
          >
            {loading ? "匯入中..." : "匯入"}
          </button>
          {message && <span className="text-sm text-zinc-600">{message}</span>}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">
            已匯入 {books.length} 本
            {search && <span className="text-base font-normal text-zinc-400 ml-2">（顯示 {filtered.length} 筆）</span>}
          </h2>
          {books.length > 0 && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜尋書名 / 作者"
                className="px-3 py-1.5 text-sm border border-zinc-300 rounded w-44"
              />
              <button
                onClick={exportCSV}
                className="px-3 py-1.5 text-sm border border-zinc-300 rounded hover:bg-zinc-50 shrink-0"
                title="匯出 CSV"
              >
                ↓ CSV
              </button>
            </div>
          )}
        </div>
        <ul className="divide-y divide-zinc-100 bg-white rounded border border-zinc-200">
          {filtered.map((b) => (
            <li key={b.id} className={`px-3 py-2 text-sm flex items-center justify-between group ${b.exclude_from_analysis ? "bg-zinc-50" : ""}`}>
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={() => toggleExclude(b.id, b.exclude_from_analysis)}
                  title={b.exclude_from_analysis ? "目前排除分析，點擊納入" : "點擊排除分析"}
                  className={`shrink-0 w-4 h-4 rounded border transition ${
                    b.exclude_from_analysis
                      ? "bg-zinc-300 border-zinc-300"
                      : "border-zinc-300 hover:border-zinc-500"
                  }`}
                />
                <div className={b.exclude_from_analysis ? "text-zinc-400" : ""}>
                  <span className="font-medium">{b.title}</span>
                  {b.author && <span className="text-zinc-500"> — {b.author}</span>}
                  {b.rating && <span className="ml-2 text-xs text-zinc-400">[{b.rating}]</span>}
                  {b.exclude_from_analysis && (
                    <span className="ml-2 text-xs text-zinc-400">（排除分析）</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => deleteBook(b.id)}
                className="ml-3 text-zinc-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition text-xs shrink-0"
                title="刪除"
              >
                ✕
              </button>
            </li>
          ))}
          {filtered.length === 0 && books.length > 0 && (
            <li className="px-3 py-6 text-sm text-zinc-400 text-center">找不到「{search}」</li>
          )}
          {books.length === 0 && (
            <li className="px-3 py-6 text-sm text-zinc-400 text-center">還沒有書</li>
          )}
        </ul>
      </section>
    </div>
  );
}
