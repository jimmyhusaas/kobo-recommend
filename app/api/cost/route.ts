import { NextResponse } from "next/server";
import { sql, DEFAULT_USER_ID } from "@/lib/db";

export async function GET() {
  const [rows, totals] = await Promise.all([
    sql`
      SELECT type, input_tokens, output_tokens, cost_usd, created_at
      FROM api_calls
      WHERE user_id = ${DEFAULT_USER_ID}
      ORDER BY created_at DESC
      LIMIT 100
    `,
    sql`
      SELECT
        COUNT(*)::int                            AS total_calls,
        SUM(input_tokens)::int                   AS total_input_tokens,
        SUM(output_tokens)::int                  AS total_output_tokens,
        ROUND(SUM(cost_usd)::numeric, 4)         AS total_cost_usd,
        COUNT(*) FILTER (WHERE type = 'analysis')::int       AS analysis_calls,
        COUNT(*) FILTER (WHERE type = 'recommendation')::int AS recommendation_calls
      FROM api_calls
      WHERE user_id = ${DEFAULT_USER_ID}
    `,
  ]);

  return NextResponse.json({
    summary: totals[0] ?? {
      total_calls: 0,
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_cost_usd: "0.0000",
      analysis_calls: 0,
      recommendation_calls: 0,
    },
    calls: rows,
  });
}
