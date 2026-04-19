"use client";
import { useEffect, useState } from "react";

type Category = {
  name: string;
  count: number;
  percentage: number;
  books: string[];
};

type AnalysisResult = {
  total_books: number;
  categories: Category[];
  patterns: string[];
  blind_spots: string[];
  sharp_observation: string;
};

type AnalysisMeta = {
  created_at: string;
  book_count: number;       // 上次分析時納入的本數
  current_book_count: number; // 目前未排除的本數
  total_book_count: number;   // 書單總本數（含排除）
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

function StatusBanner({ meta, onRerun }: { meta: AnalysisMeta; onRerun: () => void }) {
  const diff = meta.current_book_count - meta.book_count;

  if (diff === 0) {
    return (
      <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded text-sm">
        <span className="text-green-700">
          ✓ 書單無異動，分析仍有效
          <span className="text-green-500 ml-2">（上次分析：{timeAgo(meta.created_at)}，共 {meta.book_count} 本）</span>
        </span>
      </div>
    );
  }

  if (diff > 0) {
    return (
      <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded text-sm">
        <span className="text-amber-700">
          ⚠ 書單新增了 <strong>{diff} 本</strong>，建議重新分析
          <span className="text-amber-500 ml-2">（上次分析：{timeAgo(meta.created_at)}）</span>
        </span>
        <button
          onClick={onRerun}
          className="ml-3 px-2 py-1 text-xs bg-amber-600 text-white rounded hover:bg-amber-700 shrink-0"
        >
          立即重新分析
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded text-sm">
      <span className="text-amber-700">
        ⚠ 書單刪除了 <strong>{Math.abs(diff)} 本</strong>，建議重新分析
        <span className="text-amber-500 ml-2">（上次分析：{timeAgo(meta.created_at)}）</span>
      </span>
      <button
        onClick={onRerun}
        className="ml-3 px-2 py-1 text-xs bg-amber-600 text-white rounded hover:bg-amber-700 shrink-0"
      >
        立即重新分析
      </button>
    </div>
  );
}

export default function AnalysisPage() {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [meta, setMeta] = useState<AnalysisMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadLatest() {
    const res = await fetch("/api/analysis");
    const data = await res.json();
    if (data.result) {
      setAnalysis(data.result);
      setMeta({
        created_at: data.created_at,
        book_count: data.book_count,
        current_book_count: data.current_book_count,
        total_book_count: data.total_book_count,
      });
    }
  }

  useEffect(() => {
    loadLatest();
  }, []);

  async function run() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/analysis", { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setAnalysis(data);
      // 重新分析後重新拉 meta
      loadLatest();
    } else {
      setError(data.error ?? "分析失敗");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">閱讀類型拆解</h1>
        <button
          onClick={run}
          disabled={loading}
          className="px-3 py-2 text-sm bg-zinc-900 text-white rounded disabled:opacity-40"
        >
          {loading ? "分析中..." : analysis ? "重新分析" : "開始分析"}
        </button>
      </div>

      {/* 書單變動提示 */}
      {meta && !loading && (
        <>
          <StatusBanner meta={meta} onRerun={run} />
          {meta.total_book_count > meta.current_book_count && (
            <p className="text-xs text-zinc-400">
              書單共 {meta.total_book_count} 本，已排除 {meta.total_book_count - meta.current_book_count} 本，本次分析納入 {meta.current_book_count} 本
            </p>
          )}
        </>
      )}

      {loading && (
        <div className="p-3 bg-zinc-50 border border-zinc-200 rounded text-sm text-zinc-500">
          分析中，請稍候...
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {analysis && (
        <>
          <section>
            <h2 className="text-lg font-semibold mb-2">
              類型分佈（總計 {analysis.total_books} 本）
            </h2>
            <ul className="space-y-2">
              {analysis.categories.map((c, i) => (
                <li key={i} className="p-3 border border-zinc-200 rounded bg-white">
                  <div className="flex justify-between">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-zinc-500 text-sm">{c.count} 本 / {c.percentage}%</span>
                  </div>
                  {c.books?.length > 0 && (
                    <div className="text-xs text-zinc-500 mt-1">{c.books.join("、")}</div>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">交叉觀察</h2>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              {analysis.patterns.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">閱讀盲區</h2>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              {analysis.blind_spots.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">直接觀察</h2>
            <p className="p-3 bg-amber-50 border border-amber-200 rounded text-sm">
              {analysis.sharp_observation}
            </p>
          </section>
        </>
      )}

      {!analysis && !loading && !error && (
        <p className="text-sm text-zinc-500">
          還沒有分析結果。按「開始分析」或先回首頁匯入書單。
        </p>
      )}
    </div>
  );
}
