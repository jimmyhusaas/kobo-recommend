import { NextResponse } from "next/server";
import { sql, DEFAULT_USER_ID } from "@/lib/db";
import { anthropic, MODEL } from "@/lib/claude";
import { ANALYSIS_TOOL, analysisPrompt } from "@/lib/prompts";

export async function POST() {
  const books = await sql`
    SELECT title, author, rating, note
    FROM books_read
    WHERE user_id = ${DEFAULT_USER_ID}
    ORDER BY created_at ASC
  ` as unknown as Array<{
    title: string;
    author: string | null;
    rating: string | null;
    note: string | null;
  }>;

  if (books.length === 0) {
    return NextResponse.json(
      { error: "還沒有書可以分析，先到首頁匯入" },
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
  const rows = await sql`
    SELECT result, book_count, created_at
    FROM analyses
    WHERE user_id = ${DEFAULT_USER_ID}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (rows.length === 0) {
    return NextResponse.json({ result: null });
  }

  return NextResponse.json({
    result: rows[0].result,
    book_count: rows[0].book_count,
    created_at: rows[0].created_at,
  });
}
