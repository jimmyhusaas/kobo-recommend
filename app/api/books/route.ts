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

  const rows = books.map((b) => ({
    user_id: DEFAULT_USER_ID,
    title: b.title,
    author: b.author,
    rating: b.rating,
  }));

  const inserted = await sql`
    INSERT INTO books_read ${sql(rows, "user_id", "title", "author", "rating")}
    RETURNING id
  `;

  return NextResponse.json({ inserted: inserted.length });
}

export async function GET() {
  const books = await sql`
    SELECT id, title, author, rating, created_at
    FROM books_read
    WHERE user_id = ${DEFAULT_USER_ID}
    ORDER BY created_at DESC, id DESC
  `;
  return NextResponse.json({ books });
}
