import { NextRequest, NextResponse } from "next/server";
import { sql, DEFAULT_USER_ID } from "@/lib/db";

type ParsedBook = {
  title: string;
  author: string | null;
  rating: string | null;
};

function parseBookList(text: string): ParsedBook[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return lines
    .map<ParsedBook | null>((line) => {
      // Strip leading numbering like "1. " / "1) " / "1、"
      const clean = line.replace(/^\d+[\.\)、]\s*/, "");
      // Split on em-dash / en-dash / hyphen surrounded by spaces
      const parts = clean.split(/\s+[—–\-]+\s+/);
      const title = parts[0]?.trim();
      if (!title) return null;
      const author = parts[1]?.trim() || null;
      const rawRating = parts[2]?.trim().toLowerCase();
      const rating =
        rawRating && ["liked", "neutral", "disliked"].includes(rawRating)
          ? rawRating
          : null;
      return { title, author, rating };
    })
    .filter((b): b is ParsedBook => b !== null);
}

export async function POST(req: NextRequest) {
  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const text = body.text;
  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }

  const books = parseBookList(text);
  if (books.length === 0) {
    return NextResponse.json({ error: "no books parsed" }, { status: 400 });
  }

  // 撈出已有書名（小寫比對，避免大小寫差異造成重複）
  const existing = await sql`
    SELECT lower(title) AS title FROM books_read WHERE user_id = ${DEFAULT_USER_ID}
  ` as unknown as Array<{ title: string }>;
  const existingTitles = new Set(existing.map((r) => r.title));

  const newBooks = books.filter((b) => !existingTitles.has(b.title.toLowerCase()));
  const skipped = books.length - newBooks.length;

  if (newBooks.length === 0) {
    return NextResponse.json({ inserted: 0, skipped, message: `全部 ${skipped} 本已存在，略過` });
  }

  const rows = newBooks.map((b) => ({
    user_id: DEFAULT_USER_ID,
    title: b.title,
    author: b.author,
    rating: b.rating,
  }));

  const inserted = await sql`
    INSERT INTO books_read ${sql(rows, "user_id", "title", "author", "rating")}
    RETURNING id
  `;

  const no_author_count = newBooks.filter((b) => !b.author).length;

  return NextResponse.json({ inserted: inserted.length, skipped, no_author_count });
}

export async function GET() {
  const books = await sql`
    SELECT id, title, author, rating, exclude_from_analysis, created_at
    FROM books_read
    WHERE user_id = ${DEFAULT_USER_ID}
    ORDER BY created_at DESC, id DESC
  `;
  return NextResponse.json({ books });
}
