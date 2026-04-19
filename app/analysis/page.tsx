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

export default function AnalysisPage() {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadLatest() {
    const res = await fetch("/api/analysis");
    const data = await res.json();
    if (data.result) setAnalysis(data.result);
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
                <li
                  key={i}
                  className="p-3 border border-zinc-200 rounded bg-white"
                >
                  <div className="flex justify-between">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-zinc-500 text-sm">
                      {c.count} 本 / {c.percentage}%
                    </span>
                  </div>
                  {c.books?.length > 0 && (
                    <div className="text-xs text-zinc-500 mt-1">
                      {c.books.join("、")}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">交叉觀察</h2>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              {analysis.patterns.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">閱讀盲區</h2>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              {analysis.blind_spots.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
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
