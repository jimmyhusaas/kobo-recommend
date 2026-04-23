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
      const clean = line.replace(/^\d+[\.\)、]\s*/, "");
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
  let body: { text?: string; reading_status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const text = body.text;
  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }

  const readingStatus = body.reading_status === "to_read" ? "to_read" : "read";

  const books = parseBookList(text);
  if (books.length === 0) {
    return NextResponse.json({ error: "no books parsed" }, { status: 400 });
  }

  // 撈出已有書名與其 reading_status
  const existing = await sql`
    SELECT lower(title) AS title, reading_status, id
    FROM books_read WHERE user_id = ${DEFAULT_USER_ID}
  ` as unknown as Array<{ title: string; reading_status: string; id: string }>;

  const existingMap = new Map(existing.map((r) => [r.title, { status: r.reading_status, id: r.id }]));

  const toInsert: ParsedBook[] = [];
  const toUpgrade: string[] = []; // id list: to_read → read
  const skippedBooks: ParsedBook[] = [];

  for (const b of books) {
    const key = b.title.toLowerCase();
    const existing = existingMap.get(key);
    if (!existing) {
      toInsert.push(b);
    } else if (existing.status === "to_read" && readingStatus === "read") {
      // 從待讀升級為已讀
      toUpgrade.push(existing.id);
    } else {
      skippedBooks.push(b);
    }
  }

  // 升級 to_read → read
  if (toUpgrade.length > 0) {
    await sql`
      UPDATE books_read
      SET reading_status = 'read'
      WHERE id = ANY(${toUpgrade}::uuid[]) AND user_id = ${DEFAULT_USER_ID}
    `;
  }

  if (toInsert.length === 0) {
    return NextResponse.json({
      inserted: 0,
      upgraded: toUpgrade.length,
      skipped: skippedBooks.length,
      skipped_titles: skippedBooks.map((b) => b.title),
      no_author_count: 0,
    });
  }

  const rows = toInsert.map((b) => ({
    user_id: DEFAULT_USER_ID,
    title: b.title,
    author: b.author,
    rating: b.rating,
    reading_status: readingStatus,
  }));

  const inserted = await sql`
    INSERT INTO books_read ${sql(rows, "user_id", "title", "author", "rating", "reading_status")}
    RETURNING id
  `;

  const no_author_count = toInsert.filter((b) => !b.author).length;

  return NextResponse.json({
    inserted: inserted.length,
    upgraded: toUpgrade.length,
    skipped: skippedBooks.length,
    skipped_titles: skippedBooks.map((b) => b.title),
    no_author_count,
  });
}

export async function GET() {
  const books = await sql`
    SELECT id, title, author, rating, exclude_from_analysis, reading_status, created_at
    FROM books_read
    WHERE user_id = ${DEFAULT_USER_ID}
    ORDER BY created_at DESC, id DESC
  `;
  return NextResponse.json({ books });
}
