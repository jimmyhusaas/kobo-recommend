import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { sql, DEFAULT_USER_ID } from "@/lib/db";
import { anthropic, MODEL } from "@/lib/claude";
import { RECOMMEND_TOOL, recommendPrompt } from "@/lib/prompts";

type Prefs = {
  exclude_countries?: string[];
  exclude_languages?: string[];
};

type RecommendedBook = {
  title: string;
  title_original?: string;
  author: string;
  author_nationality: string;
  reading_resistance: "low" | "medium" | "high";
  why_you: string;
  core_concepts: string;
  next_book?: string;
};

export async function GET() {
  const rows = await sql`
    SELECT id, batch_id, title, author, status, rationale, created_at
    FROM recommendations
    WHERE user_id = ${DEFAULT_USER_ID}
    ORDER BY created_at DESC
  ` as unknown as Array<{
    id: string;
    batch_id: string;
    title: string;
    author: string | null;
    status: string;
    rationale: Record<string, unknown> | null;
    created_at: string;
  }>;

  // group by batch_id，保留每個 batch 的第一筆 created_at 作為代表
  const batchMap = new Map<string, { batch_id: string; created_at: string; books: typeof rows }>();
  for (const row of rows) {
    if (!batchMap.has(row.batch_id)) {
      batchMap.set(row.batch_id, { batch_id: row.batch_id, created_at: row.created_at, books: [] });
    }
    batchMap.get(row.batch_id)!.books.push(row);
  }

  return NextResponse.json({ batches: Array.from(batchMap.values()) });
}

export async function POST(req: NextRequest) {
  let body: { directions?: string[]; count?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { directions, count = 3 } = body;
  if (!Array.isArray(directions) || directions.length === 0) {
    return NextResponse.json({ error: "directions required" }, { status: 400 });
  }
  if (typeof count !== "number" || count < 1 || count > 10) {
    return NextResponse.json({ error: "count must be 1-10" }, { status: 400 });
  }

  const [user] = (await sql`
    SELECT preferences FROM users WHERE id = ${DEFAULT_USER_ID}
  `) as unknown as Array<{ preferences: Prefs }>;

  const books = (await sql`
    SELECT title, author, rating, note
    FROM books_read
    WHERE user_id = ${DEFAULT_USER_ID}
  `) as unknown as Array<{
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

  const previousRows = (await sql`
    SELECT title FROM recommendations WHERE user_id = ${DEFAULT_USER_ID}
  `) as unknown as Array<{ title: string }>;

  const prefs = user?.preferences ?? {};
  const prompt = recommendPrompt({
    books,
    directions,
    count,
    excludedCountries: prefs.exclude_countries ?? [],
    excludedLanguages: prefs.exclude_languages ?? [],
    previousRecommendations: previousRows.map((r) => r.title),
  });

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    tools: [RECOMMEND_TOOL as never],
    tool_choice: { type: "tool", name: RECOMMEND_TOOL.name },
    messages: [{ role: "user", content: prompt }],
  });

  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    return NextResponse.json(
      { error: "Claude 沒回 tool_use block" },
      { status: 500 }
    );
  }

  const result = toolBlock.input as {
    books: RecommendedBook[];
    reading_order: string[];
    rationale_for_batch: string;
  };

  const batchId = randomUUID();

  const rows = (result.books ?? []).map((b) => ({
    user_id: DEFAULT_USER_ID,
    batch_id: batchId,
    title: b.title,
    author: b.author,
    rationale: sql.json({
      why_you: b.why_you,
      core_concepts: b.core_concepts,
      next_book: b.next_book,
      title_original: b.title_original,
      author_nationality: b.author_nationality,
      reading_resistance: b.reading_resistance,
    }),
  }));

  let inserted: Array<{ id: string }> = [];
  if (rows.length > 0) {
    inserted = (await sql`
      INSERT INTO recommendations ${sql(
        rows,
        "user_id",
        "batch_id",
        "title",
        "author",
        "rationale"
      )}
      RETURNING id
    `) as unknown as Array<{ id: string }>;
  }

  const booksWithIds = (result.books ?? []).map((b, i) => ({
    ...b,
    id: inserted[i]?.id,
    status: "pending" as const,
  }));

  return NextResponse.json({
    batch_id: batchId,
    books: booksWithIds,
    reading_order: result.reading_order ?? [],
    rationale_for_batch: result.rationale_for_batch ?? "",
  });
}
