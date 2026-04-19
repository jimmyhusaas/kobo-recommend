"use client";
import { useEffect, useState } from "react";

type Summary = {
  total_calls: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: string;
  analysis_calls: number;
  recommendation_calls: number;
};

type Call = {
  type: "analysis" | "recommendation";
  input_tokens: number;
  output_tokens: number;
  cost_usd: string;
  created_at: string;
};

const TYPE_LABEL: Record<string, string> = {
  analysis: "分析",
  recommendation: "推薦",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("zh-TW", {
    month: "numeric", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatCost(usd: string | number) {
  const n = Number(usd);
  if (n < 0.001) return "< $0.001";
  return `$${n.toFixed(4)}`;
}

export default function CostPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cost")
      .then((r) => r.json())
      .then((d) => {
        setSummary(d.summary);
        setCalls(d.calls ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-zinc-400">載入中...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">API 費用追蹤</h1>

      {/* 累計總覽 */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="p-4 bg-white border border-zinc-200 rounded text-center">
          <div className="text-2xl font-bold text-zinc-900">
            {formatCost(summary?.total_cost_usd ?? 0)}
          </div>
          <div className="text-xs text-zinc-500 mt-1">累計花費（USD）</div>
        </div>
        <div className="p-4 bg-white border border-zinc-200 rounded text-center">
          <div className="text-2xl font-bold text-zinc-900">
            {summary?.total_calls ?? 0}
          </div>
          <div className="text-xs text-zinc-500 mt-1">總呼叫次數</div>
        </div>
        <div className="p-4 bg-white border border-zinc-200 rounded text-center">
          <div className="text-2xl font-bold text-zinc-900">
            {summary?.analysis_calls ?? 0}
          </div>
          <div className="text-xs text-zinc-500 mt-1">分析次數</div>
        </div>
        <div className="p-4 bg-white border border-zinc-200 rounded text-center">
          <div className="text-2xl font-bold text-zinc-900">
            {summary?.recommendation_calls ?? 0}
          </div>
          <div className="text-xs text-zinc-500 mt-1">推薦次數</div>
        </div>
      </section>

      {/* token 合計 */}
      {summary && summary.total_calls > 0 && (
        <section className="p-3 bg-zinc-50 border border-zinc-200 rounded text-sm text-zinc-500 flex gap-6">
          <span>輸入 token：{summary.total_input_tokens.toLocaleString()}</span>
          <span>輸出 token：{summary.total_output_tokens.toLocaleString()}</span>
          <span className="text-zinc-400 text-xs">
            （模型：claude-sonnet-4-6，輸入 $3 / 輸出 $15 per 1M tokens）
          </span>
        </section>
      )}

      {/* 明細 */}
      <section>
        <h2 className="text-lg font-semibold mb-3">呼叫明細</h2>
        {calls.length === 0 ? (
          <p className="text-sm text-zinc-400">還沒有記錄，先去分析或產出推薦。</p>
        ) : (
          <div className="bg-white border border-zinc-200 rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="px-4 py-2 text-left text-zinc-500 font-medium">時間</th>
                  <th className="px-4 py-2 text-left text-zinc-500 font-medium">類型</th>
                  <th className="px-4 py-2 text-right text-zinc-500 font-medium">輸入 token</th>
                  <th className="px-4 py-2 text-right text-zinc-500 font-medium">輸出 token</th>
                  <th className="px-4 py-2 text-right text-zinc-500 font-medium">費用</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {calls.map((c, i) => (
                  <tr key={i} className="hover:bg-zinc-50">
                    <td className="px-4 py-2 text-zinc-500">{formatDate(c.created_at)}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        c.type === "analysis"
                          ? "bg-blue-50 text-blue-600"
                          : "bg-green-50 text-green-600"
                      }`}>
                        {TYPE_LABEL[c.type] ?? c.type}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-zinc-500">{c.input_tokens.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-zinc-500">{c.output_tokens.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatCost(c.cost_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
