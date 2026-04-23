"use client";
import { useState, useEffect } from "react";

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
  estimated_read_hours?: number;
  why_you: string;
  core_concepts: string;
  next_book?: string;
  status?: string;
};

type Batch = {
  batch_id: string;
  books: RecBook[];
  reading_order: string[];
  rationale_for_batch: string;
};

type AnalysisMeta = {
  created_at: string;
  book_count: number;
  blind_spots: string[];
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "剛剛";
  if (mins < 60) return `${mins} 分鐘前`;
  if (hours < 24) return `${hours} 小時前`;
  return `${days} 天前`;
}

const RESISTANCE_LABEL: Record<string, string> = {
  low: "易讀",
  medium: "適中",
  high: "有挑戰",
};

export default function RecommendPage() {
  const [directions, setDirections] = useState<string[]>([]);
  const [customDirection, setCustomDirection] = useState("");
  const [count, setCount] = useState(3);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisMeta, setAnalysisMeta] = useState<AnalysisMeta | null>(null);

  useEffect(() => {
    fetch("/api/analysis")
      .then((r) => r.json())
      .then((d) => {
        if (d.created_at) {
          setAnalysisMeta({
            created_at: d.created_at,
            book_count: d.book_count,
            blind_spots: d.result?.blind_spots ?? [],
          });
        }
      })
      .catch(() => {});
  }, []);

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

  async function run() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directions, count }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) setBatch(data);
    else setError(data.error ?? "推薦失敗");
  }

  async function patchStatus(id: string | undefined, status: string) {
    if (!id) return;
    await fetch(`/api/recommendations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  function updateBookStatus(id: string | undefined, updates: Partial<RecBook>) {
    if (!id) return;
    setBatch((b) =>
      b ? { ...b, books: b.books.map((x) => (x.id === id ? { ...x, ...updates } : x)) } : b
    );
  }

  // 想讀：加進書單 + status = in_list
  async function addToList(book: RecBook) {
    const text = book.author ? `${book.title} — ${book.author}` : book.title;
    await Promise.all([
      fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      }),
      patchStatus(book.id, "in_list"),
    ]);
    updateBookStatus(book.id, { status: "in_list" });
  }

  // 讀完：若未在書單先加入，然後 status = read
  async function markFinished(book: RecBook) {
    const ops: Promise<unknown>[] = [patchStatus(book.id, "read")];
    if (book.status !== "in_list") {
      const text = book.author ? `${book.title} — ${book.author}` : book.title;
      ops.push(
        fetch("/api/books", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        })
      );
    }
    await Promise.all(ops);
    updateBookStatus(book.id, { status: "read" });
  }

  async function markSkipped(book: RecBook) {
    await patchStatus(book.id, "skipped");
    updateBookStatus(book.id, { status: "skipped" });
  }

  async function resetStatus(book: RecBook) {
    await patchStatus(book.id, "pending");
    updateBookStatus(book.id, { status: "pending" });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">下一批推薦</h1>
        {analysisMeta ? (
          <a href="/analysis" className="text-xs text-zinc-400 hover:text-zinc-600 hover:underline">
            根據 {timeAgo(analysisMeta.created_at)} 的閱讀分析（{analysisMeta.book_count} 本）↗
          </a>
        ) : (
          <a href="/analysis" className="text-xs text-amber-500 hover:underline">
            ⚠ 尚未分析，推薦準確度較低
          </a>
        )}
      </div>

      <section className="space-y-4 p-4 bg-white border border-zinc-200 rounded">

        {/* 來自分析的建議方向 */}
        {analysisMeta && analysisMeta.blind_spots.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-2">
              來自閱讀分析的建議
            </label>
            <div className="flex flex-wrap gap-2">
              {analysisMeta.blind_spots.map((spot) => (
                <button
                  key={spot}
                  onClick={() => toggleDirection(spot)}
                  className={`px-3 py-1 text-xs rounded border transition ${
                    directions.includes(spot)
                      ? "bg-zinc-900 text-white border-zinc-900"
                      : "border-amber-300 text-amber-700 hover:border-amber-500 hover:bg-amber-50"
                  }`}
                >
                  {spot}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 預設方向選項 */}
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

        {/* 自訂方向 */}
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

        {/* 已選方向 */}
        {directions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {directions.map((d) => (
              <span key={d} className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-900 text-white rounded">
                {d}
                <button onClick={() => removeDirection(d)} className="hover:text-zinc-300">✕</button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">數量</label>
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
            className="mt-5 px-4 py-2 bg-zinc-900 text-white rounded disabled:opacity-40"
          >
            {loading ? "生成中..." : "產出推薦"}
          </button>
        </div>
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
        <article key={b.id ?? i} className="p-4 bg-white border border-zinc-200 rounded space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold">
                {i + 1}. 《{b.title}》
                {b.title_original && (
                  <span className="text-zinc-500 text-sm font-normal"> — {b.title_original}</span>
                )}
              </h3>
              <div className="text-xs text-zinc-500 flex items-center gap-2 flex-wrap mt-0.5">
                <span>{b.author} ({b.author_nationality})</span>
                <span className="text-zinc-300">·</span>
                <span>閱讀阻力：{RESISTANCE_LABEL[b.reading_resistance] ?? b.reading_resistance}</span>
                {b.estimated_read_hours && (
                  <>
                    <span className="text-zinc-300">·</span>
                    <span>約 {b.estimated_read_hours} 小時</span>
                  </>
                )}
                <a
                  href={`https://search.books.com.tw/search/query/key/${encodeURIComponent(b.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  博客來 ↗
                </a>
              </div>
            </div>

            {/* 狀態動作區 */}
            <div className="shrink-0 flex flex-col items-end gap-1">
              {b.status === "read" ? (
                <>
                  <span className="text-xs text-green-600 font-medium">✓ 已讀完</span>
                  <button
                    onClick={() => resetStatus(b)}
                    className="text-xs text-zinc-300 hover:text-zinc-500"
                  >
                    重設
                  </button>
                </>
              ) : b.status === "in_list" ? (
                <>
                  <span className="text-xs text-blue-600 font-medium">📚 已加入書單</span>
                  <button
                    onClick={() => markFinished(b)}
                    className="px-2 py-1 text-xs rounded border border-green-300 text-green-700 hover:bg-green-50 whitespace-nowrap"
                  >
                    讀完了
                  </button>
                  <button
                    onClick={() => resetStatus(b)}
                    className="text-xs text-zinc-300 hover:text-zinc-500"
                  >
                    移除
                  </button>
                </>
              ) : b.status === "skipped" ? (
                <>
                  <span className="text-xs text-zinc-400">跳過</span>
                  <button
                    onClick={() => resetStatus(b)}
                    className="text-xs text-zinc-300 hover:text-zinc-500"
                  >
                    重設
                  </button>
                </>
              ) : (
                // pending
                <>
                  <button
                    onClick={() => addToList(b)}
                    className="px-2 py-1 text-xs rounded border border-zinc-300 hover:bg-zinc-50 whitespace-nowrap"
                  >
                    + 加入書單
                  </button>
                  <button
                    onClick={() => markSkipped(b)}
                    className="text-xs text-zinc-400 hover:text-zinc-600"
                  >
                    跳過
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="text-sm">
            <span className="font-medium text-zinc-700">為什麼是你：</span>
            <span className="text-zinc-600">{b.why_you}</span>
          </div>
          <div className="text-sm">
            <span className="font-medium text-zinc-700">讀完得到：</span>
            <span className="text-zinc-600">{b.core_concepts}</span>
          </div>
          {b.next_book && (
            <div className="text-xs text-zinc-400">讀完下一步：{b.next_book}</div>
          )}
        </article>
      ))}

      {batch && batch.reading_order.length > 0 && (
        <section className="p-3 bg-zinc-100 rounded text-sm">
          <div className="font-medium mb-1">建議順序</div>
          <ol className="list-decimal pl-5">
            {batch.reading_order.map((t, i) => <li key={i}>{t}</li>)}
          </ol>
        </section>
      )}
    </div>
  );
}
