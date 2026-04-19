"use client";
import { useEffect, useState } from "react";

type Book = {
  id: string;
  title: string;
  author: string | null;
  status: string;
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

const STATUS_LABEL: Record<string, string> = {
  pending: "待讀",
  read: "已讀",
  rejected: "跳過",
  skipped: "跳過",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "text-zinc-400",
  read: "text-green-600",
  rejected: "text-red-400",
  skipped: "text-red-400",
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
        // 預設展開最新一批
        if (d.batches?.length > 0) {
          setExpanded(new Set([d.batches[0].batch_id]));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function updateStatus(id: string, status: string, batchId: string) {
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
      <p className="text-sm text-zinc-500">共 {batches.length} 批推薦，{batches.reduce((s, b) => s + b.books.length, 0)} 本書</p>

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
                <span className="font-medium">
                  第 {batches.length - idx} 批
                </span>
                <span className="text-zinc-400 text-sm ml-2">{formatDate(batch.created_at)}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-zinc-500">
                <span>{readCount}/{batch.books.length} 已讀</span>
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
                      </div>
                      <span className={`text-xs shrink-0 ${STATUS_COLOR[book.status] ?? "text-zinc-400"}`}>
                        {STATUS_LABEL[book.status] ?? book.status}
                      </span>
                    </div>

                    {book.rationale?.why_you && (
                      <p className="text-xs text-zinc-500">{book.rationale.why_you}</p>
                    )}

                    <div className="flex gap-1 pt-1">
                      {book.status !== "read" && (
                        <button
                          onClick={() => updateStatus(book.id, "read", batch.batch_id)}
                          className="px-2 py-0.5 text-xs rounded border border-zinc-300 hover:bg-green-50 hover:border-green-400"
                        >
                          標為已讀
                        </button>
                      )}
                      {book.status !== "skipped" && book.status !== "rejected" && (
                        <button
                          onClick={() => updateStatus(book.id, "skipped", batch.batch_id)}
                          className="px-2 py-0.5 text-xs rounded border border-zinc-300 hover:bg-red-50 hover:border-red-400"
                        >
                          跳過
                        </button>
                      )}
                      {(book.status === "read" || book.status === "skipped" || book.status === "rejected") && (
                        <button
                          onClick={() => updateStatus(book.id, "pending", batch.batch_id)}
                          className="px-2 py-0.5 text-xs rounded border border-zinc-300 hover:bg-zinc-100"
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
