"use client";
import { useState } from "react";

const DIRECTION_OPTIONS = [
  "技術深度（系統設計 / 架構）",
  "英文原文書入門",
  "經典商業 / 策略書",
  "非虛構敘事 / 長週期視野",
  "認知科學 / 決策原典",
  "投資 / 資產配置進階",
];

type RecBook = {
  id?: string;
  title: string;
  title_original?: string;
  author: string;
  author_nationality: string;
  reading_resistance: string;
  why_you: string;
  core_concepts: string;
  next_book?: string;
  status?: string;
  addedToList?: boolean;
};

type Batch = {
  batch_id: string;
  books: RecBook[];
  reading_order: string[];
  rationale_for_batch: string;
};

export default function RecommendPage() {
  const [directions, setDirections] = useState<string[]>([]);
  const [customDirection, setCustomDirection] = useState("");
  const [count, setCount] = useState(3);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleDirection(d: string) {
    setDirections((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  }

  function addCustomDirection() {
    const d = customDirection.trim();
    if (!d || directions.includes(d)) return;
    setDirections((prev) => [...prev, d]);
    setCustomDirection("");
  }

  function removeDirection(d: string) {
    setDirections((prev) => prev.filter((x) => x !== d));
  }

  const allDirections = [...directions];

  async function run() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directions: allDirections, count }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setBatch(data);
    } else {
      setError(data.error ?? "推薦失敗");
    }
  }

  async function updateStatus(id: string | undefined, status: string) {
    if (!id) return;
    await fetch(`/api/recommendations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBatch((b) =>
      b ? { ...b, books: b.books.map((x) => (x.id === id ? { ...x, status } : x)) } : b
    );
  }

  async function addToReadList(book: RecBook) {
    const text = book.author
      ? `${book.title} — ${book.author}`
      : book.title;
    await fetch("/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    setBatch((b) =>
      b ? { ...b, books: b.books.map((x) => (x.id === book.id ? { ...x, addedToList: true } : x)) } : b
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">下一批推薦</h1>

      <section className="space-y-4 p-4 bg-white border border-zinc-200 rounded">
        {/* 預設方向 */}
        <div>
          <label className="block text-sm font-medium mb-2">
            方向（可複選，建議最多 2 個）
          </label>
          <div className="flex flex-wrap gap-2">
            {DIRECTION_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => toggleDirection(d)}
                className={`px-3 py-1 text-xs rounded border transition ${
                  directions.includes(d)
                    ? "bg-zinc-900 text-white border-zinc-900"
                    : "border-zinc-300 hover:border-zinc-500"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* 自訂方向輸入 */}
        <div>
          <label className="block text-sm font-medium mb-2">自訂方向</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customDirection}
              onChange={(e) => setCustomDirection(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustomDirection()}
              placeholder="例：台灣本土作品、科幻小說入門..."
              className="flex-1 p-2 text-sm border border-zinc-300 rounded"
            />
            <button
              onClick={addCustomDirection}
              disabled={!customDirection.trim()}
              className="px-3 py-2 text-sm border border-zinc-300 rounded hover:bg-zinc-50 disabled:opacity-40"
            >
              加入
            </button>
          </div>
        </div>

        {/* 已選方向（含自訂）*/}
        {directions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {directions.map((d) => (
              <span
                key={d}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-900 text-white rounded"
              >
                {d}
                <button onClick={() => removeDirection(d)} className="hover:text-zinc-300">✕</button>
              </span>
            ))}
          </div>
        )}

        {/* 數量 */}
        <div>
          <label className="block text-sm font-medium mb-2">數量</label>
          <input
            type="number"
            min={1}
            max={10}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-20 p-2 border border-zinc-300 rounded"
          />
        </div>

        <button
          onClick={run}
          disabled={loading || directions.length === 0}
          className="px-4 py-2 bg-zinc-900 text-white rounded disabled:opacity-40"
        >
          {loading ? "生成中..." : "產出推薦"}
        </button>
      </section>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {batch?.rationale_for_batch && (
        <section className="p-3 bg-blue-50 border border-blue-200 rounded text-sm">
          <div className="font-medium mb-1">配比邏輯</div>
          {batch.rationale_for_batch}
        </section>
      )}

      {batch?.books.map((b, i) => (
        <article
          key={b.id ?? i}
          className="p-4 bg-white border border-zinc-200 rounded space-y-2"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">
                {i + 1}. 《{b.title}》
                {b.title_original && (
                  <span className="text-zinc-500 text-sm font-normal">
                    {" "}— {b.title_original}
                  </span>
                )}
              </h3>
              <div className="text-xs text-zinc-500">
                {b.author} ({b.author_nationality}) · 阻力：{b.reading_resistance}
              </div>
            </div>
            <div className="flex flex-col gap-1 shrink-0 items-end">
              <div className="flex gap-1">
                <button
                  onClick={() => updateStatus(b.id, "read")}
                  className={`px-2 py-1 text-xs rounded border ${
                    b.status === "read"
                      ? "bg-green-100 border-green-400"
                      : "border-zinc-300 hover:border-zinc-500"
                  }`}
                >
                  已讀
                </button>
                <button
                  onClick={() => updateStatus(b.id, "rejected")}
                  className={`px-2 py-1 text-xs rounded border ${
                    b.status === "rejected"
                      ? "bg-red-100 border-red-400"
                      : "border-zinc-300 hover:border-zinc-500"
                  }`}
                >
                  跳過
                </button>
              </div>
              <button
                onClick={() => addToReadList(b)}
                disabled={b.addedToList}
                className="px-2 py-1 text-xs rounded border border-zinc-300 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-default"
              >
                {b.addedToList ? "已加入書單 ✓" : "+ 加入書單"}
              </button>
            </div>
          </div>
          <div className="text-sm">
            <span className="font-medium">為什麼是你：</span>
            {b.why_you}
          </div>
          <div className="text-sm">
            <span className="font-medium">核心概念：</span>
            {b.core_concepts}
          </div>
          {b.next_book && (
            <div className="text-xs text-zinc-500">讀完下一步：{b.next_book}</div>
          )}
        </article>
      ))}

      {batch && batch.reading_order.length > 0 && (
        <section className="p-3 bg-zinc-100 rounded text-sm">
          <div className="font-medium mb-1">建議順序</div>
          <ol className="list-decimal pl-5">
            {batch.reading_order.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
