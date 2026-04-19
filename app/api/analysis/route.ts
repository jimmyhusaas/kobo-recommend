import { NextResponse } from "next/server";
import { sql, DEFAULT_USER_ID } from "@/lib/db";
import { anthropic, MODEL } from "@/lib/claude";
import { ANALYSIS_TOOL, analysisPrompt } from "@/lib/prompts";

export async function POST() {
  const books = await sql`
    SELECT title, author, rating, note
    FROM books_read
    WHERE user_id = ${DEFAULT_USER_ID}
      AND exclude_from_analysis = false
    ORDER BY created_at ASC
  ` as unknown as Array<{
    title: string;
    author: string | null;
    rating: string | null;
    note: string | null;
  }>;

  if (books.length === 0) {
    return NextResponse.json(
      { error: "沒有可分析的書（書單為空，或全部已被排除）" },
      { status: 400 }
    );
  }

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    tools: [ANALYSIS_TOOL as never],
    tool_choice: { type: "tool", name: ANALYSIS_TOOL.name },
    messages: [{ role: "user", content: analysisPrompt(books) }],
  });

  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    return NextResponse.json(
      { error: "Claude 沒回 tool_use block" },
      { status: 500 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = toolBlock.input as any;

  await sql`
    INSERT INTO analyses (user_id, result, book_count)
    VALUES (${DEFAULT_USER_ID}, ${sql.json(result)}, ${books.length})
  `;

  return NextResponse.json(result);
}

export async function GET() {
  const [analysisRows, countRows, totalRows] = await Promise.all([
    sql`
      SELECT result, book_count, created_at
      FROM analyses
      WHERE user_id = ${DEFAULT_USER_ID}
      ORDER BY created_at DESC
      LIMIT 1
    `,
    sql`
      SELECT COUNT(*)::int AS count
      FROM books_read
      WHERE user_id = ${DEFAULT_USER_ID}
        AND exclude_from_analysis = false
    `,
    sql`
      SELECT COUNT(*)::int AS count
      FROM books_read
      WHERE user_id = ${DEFAULT_USER_ID}
    `,
  ]);

  const currentBookCount = (countRows[0] as unknown as { count: number }).count;
  const totalBookCount = (totalRows[0] as unknown as { count: number }).count;
  const excludedCount = totalBookCount - currentBookCount;

  if (analysisRows.length === 0) {
    return NextResponse.json({ result: null, current_book_count: currentBookCount, total_book_count: totalBookCount });
  }

  return NextResponse.json({
    result: analysisRows[0].result,
    book_count: analysisRows[0].book_count,
    created_at: analysisRows[0].created_at,
    current_book_count: currentBookCount,
    total_book_count: totalBookCount,
    excluded_count: excludedCount,
  });
}
