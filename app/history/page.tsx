"use client";
import { useEffect, useState } from "react";

type Book = {
  id: string;
  title: string;
  author: string | null;
  status: string;
  inList?: boolean;
  rationale: {
    why_you?: string;
    core_concepts?: string;
    reading_resistance?: string;
    author_nationality?: string;
    next_book?: string;
  } | null;
};

type Batch = {
  batch_id: string;
  created_at: string;
  books: Book[];
};

export default function HistoryPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/recommendations")
      .then((r) => r.json())
      .then((d) => {
        setBatches(d.batches ?? []);
        if (d.batches?.length > 0) {
          setExpanded(new Set([d.batches[0].batch_id]));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function patchStatus(id: string, status: string, batchId: string) {
    await fetch(`/api/recommendations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBatches((prev) =>
      prev.map((b) =>
        b.batch_id === batchId
          ? { ...b, books: b.books.map((bk) => (bk.id === id ? { ...bk, status } : bk)) }
          : b
      )
    );
  }

  async function addToList(book: Book, batchId: string) {
    const text = book.author ? `${book.title} — ${book.author}` : book.title;
    await fetch("/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    setBatches((prev) =>
      prev.map((b) =>
        b.batch_id === batchId
          ? { ...b, books: b.books.map((bk) => (bk.id === book.id ? { ...bk, inList: true } : bk)) }
          : b
      )
    );
  }

  async function markFinished(book: Book, batchId: string) {
    await addToList(book, batchId);
    await patchStatus(book.id, "read", batchId);
  }

  function toggleBatch(batchId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(batchId) ? next.delete(batchId) : next.add(batchId);
      return next;
    });
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("zh-TW", {
      year: "numeric", month: "long", day: "numeric",
    });
  }

  if (loading) return <p className="text-sm text-zinc-400">載入中...</p>;

  if (batches.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">推薦歷史</h1>
        <p className="text-sm text-zinc-500">還沒有推薦記錄，先到「推薦」頁產出第一批。</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">推薦歷史</h1>
      <p className="text-sm text-zinc-500">
        共 {batches.length} 批推薦，{batches.reduce((s, b) => s + b.books.length, 0)} 本書
      </p>

      {batches.map((batch, idx) => {
        const isOpen = expanded.has(batch.batch_id);
        const readCount = batch.books.filter((b) => b.status === "read").length;

        return (
          <div key={batch.batch_id} className="border border-zinc-200 rounded bg-white">
            <button
              onClick={() => toggleBatch(batch.batch_id)}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-zinc-50"
            >
              <div>
                <span className="font-medium">第 {batches.length - idx} 批</span>
                <span className="text-zinc-400 text-sm ml-2">{formatDate(batch.created_at)}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-zinc-500">
                <span>{readCount}/{batch.books.length} 已讀完</span>
                <span>{isOpen ? "▲" : "▼"}</span>
              </div>
            </button>

            {isOpen && (
              <ul className="divide-y divide-zinc-100 border-t border-zinc-100">
                {batch.books.map((book) => (
                  <li key={book.id} className="px-4 py-3 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-medium">《{book.title}》</span>
                        {book.author && (
                          <span className="text-zinc-500 text-sm"> — {book.author}</span>
                        )}
                        {book.rationale?.reading_resistance && (
                          <span className="text-xs text-zinc-400 ml-1">
                            · 阻力 {book.rationale.reading_resistance}
                          </span>
                        )}
                        <a
                          href={`https://search.books.com.tw/search/query/key/${encodeURIComponent(book.title)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 text-xs text-blue-500 hover:underline"
                        >
                          博客來 ↗
                        </a>
                      </div>

                      {/* 狀態標籤 */}
                      <div className="shrink-0 text-right space-y-0.5">
                        {book.status === "read" && (
                          <div className="text-xs text-green-600 font-medium">已讀完 ✓</div>
                        )}
                        {book.status === "skipped" && (
                          <div className="text-xs text-zinc-400">已跳過</div>
                        )}
                        {(book.inList && book.status !== "read") && (
                          <div className="text-xs text-blue-500">已加入書單</div>
                        )}
                      </div>
                    </div>

                    {book.rationale?.why_you && (
                      <p className="text-xs text-zinc-500">{book.rationale.why_you}</p>
                    )}

                    {/* 動作按鈕 */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {book.status !== "read" && (
                        <>
                          {!book.inList && (
                            <button
                              onClick={() => addToList(book, batch.batch_id)}
                              className="px-2 py-0.5 text-xs rounded border border-zinc-300 hover:bg-zinc-50"
                            >
                              + 加入書單
                            </button>
                          )}
                          <button
                            onClick={() => markFinished(book, batch.batch_id)}
                            className="px-2 py-0.5 text-xs rounded border border-green-300 text-green-700 hover:bg-green-50"
                          >
                            已讀完
                          </button>
                          {book.status !== "skipped" && (
                            <button
                              onClick={() => patchStatus(book.id, "skipped", batch.batch_id)}
                              className="px-2 py-0.5 text-xs rounded border border-zinc-300 text-zinc-500 hover:bg-zinc-50"
                            >
                              跳過
                            </button>
                          )}
                        </>
                      )}
                      {(book.status === "read" || book.status === "skipped") && (
                        <button
                          onClick={() => patchStatus(book.id, "pending", batch.batch_id)}
                          className="px-2 py-0.5 text-xs rounded border border-zinc-300 hover:bg-zinc-100 text-zinc-400"
                        >
                          重設
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
