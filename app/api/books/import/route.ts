import { NextRequest, NextResponse } from "next/server";
import { sql, DEFAULT_USER_ID } from "@/lib/db";

// RFC 4180 CSV parser（支援 quoted fields with embedded commas/newlines）
function parseCSV(content: string): string[][] {
  const rows: string[][] = [];
  let pos = 0;
  const len = content.length;

  // 略過 BOM
  if (content.charCodeAt(0) === 0xfeff) pos = 1;

  while (pos < len) {
    const row: string[] = [];
    let endOfRow = false;

    while (!endOfRow && pos < len) {
      let field = "";

      if (content[pos] === '"') {
        pos++; // 略過開頭 "
        while (pos < len) {
          if (content[pos] === '"') {
            if (content[pos + 1] === '"') {
              field += '"';
              pos += 2;
            } else {
              pos++; // 略過結尾 "
              break;
            }
          } else {
            field += content[pos++];
          }
        }
      } else {
        while (pos < len && content[pos] !== "," && content[pos] !== "\n" && content[pos] !== "\r") {
          field += content[pos++];
        }
      }

      row.push(field);

      if (pos >= len) {
        endOfRow = true;
      } else if (content[pos] === ",") {
        pos++;
      } else if (content[pos] === "\r") {
        pos++;
        if (pos < len && content[pos] === "\n") pos++;
        endOfRow = true;
      } else if (content[pos] === "\n") {
        pos++;
        endOfRow = true;
      }
    }

    if (row.some((f) => f.length > 0)) rows.push(row);
  }

  return rows;
}

function mapRating(raw: string): string | null {
  const n = parseInt(raw, 10);
  if (isNaN(n) || n === 0) return null;
  if (n >= 4) return "liked";
  if (n === 3) return "neutral";
  return "disliked"; // 1-2
}

function mapShelf(shelf: string): "read" | "to_read" | null {
  const s = shelf.toLowerCase();
  if (s === "read") return "read";
  if (s === "to-read" || s === "currently-reading") return "to_read";
  return null;
}

export async function POST(req: NextRequest) {
  let text: string;
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "缺少檔案" }, { status: 400 });
    text = await file.text();
  } catch {
    return NextResponse.json({ error: "無效的表單資料" }, { status: 400 });
  }

  const rows = parseCSV(text);
  if (rows.length < 2) {
    return NextResponse.json({ error: "CSV 無內容" }, { status: 400 });
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const titleIdx = header.indexOf("title");
  const authorIdx = header.indexOf("author");
  const ratingIdx = header.indexOf("my rating");
  const shelfIdx = header.indexOf("exclusive shelf");

  if (titleIdx === -1 || shelfIdx === -1) {
    return NextResponse.json(
      { error: "找不到必要欄位（Title / Exclusive Shelf），請確認是 Goodreads 匯出的 CSV" },
      { status: 400 }
    );
  }

  type ParsedBook = {
    title: string;
    author: string | null;
    rating: string | null;
    reading_status: "read" | "to_read";
  };

  const books: ParsedBook[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const title = row[titleIdx]?.trim();
    if (!title) continue;

    const shelf = row[shelfIdx]?.trim() ?? "";
    const reading_status = mapShelf(shelf);
    if (!reading_status) continue;

    const author = authorIdx !== -1 ? (row[authorIdx]?.trim() || null) : null;
    const rating = ratingIdx !== -1 ? mapRating(row[ratingIdx]?.trim() ?? "0") : null;

    books.push({ title, author, rating, reading_status });
  }

  if (books.length === 0) {
    return NextResponse.json(
      { error: "CSV 中沒有可匯入的書（需含 read / to-read / currently-reading shelf）" },
      { status: 400 }
    );
  }

  const existing = await sql`
    SELECT lower(title) AS title, reading_status, id
    FROM books_read WHERE user_id = ${DEFAULT_USER_ID}
  ` as unknown as Array<{ title: string; reading_status: string; id: string }>;

  const existingMap = new Map(existing.map((r) => [r.title, { status: r.reading_status, id: r.id }]));

  const toInsert: ParsedBook[] = [];
  const toUpgrade: string[] = [];
  let skipped = 0;

  for (const b of books) {
    const key = b.title.toLowerCase();
    const ex = existingMap.get(key);
    if (!ex) {
      toInsert.push(b);
    } else if (ex.status === "to_read" && b.reading_status === "read") {
      toUpgrade.push(ex.id);
    } else {
      skipped++;
    }
  }

  if (toUpgrade.length > 0) {
    await sql`
      UPDATE books_read SET reading_status = 'read'
      WHERE id = ANY(${toUpgrade}::uuid[]) AND user_id = ${DEFAULT_USER_ID}
    `;
  }

  let inserted = 0;
  if (toInsert.length > 0) {
    const insertRows = toInsert.map((b) => ({
      user_id: DEFAULT_USER_ID,
      title: b.title,
      author: b.author,
      rating: b.rating,
      reading_status: b.reading_status,
    }));
    const result = await sql`
      INSERT INTO books_read ${sql(insertRows, "user_id", "title", "author", "rating", "reading_status")}
      RETURNING id
    `;
    inserted = result.length;
  }

  return NextResponse.json({ inserted, upgraded: toUpgrade.length, skipped });
}
