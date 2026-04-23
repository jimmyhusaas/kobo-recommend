import { NextRequest, NextResponse } from "next/server";

type GBVolume = {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    publishedDate?: string;
    publisher?: string;
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
    };
    language?: string;
    industryIdentifiers?: Array<{ type: string; identifier: string }>;
  };
};

const API_KEY = process.env.GOOGLE_BOOKS_API_KEY ?? "";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "q required" }, { status: 400 });

  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", q);
  url.searchParams.set("maxResults", "10");
  url.searchParams.set("printType", "books");
  if (API_KEY) url.searchParams.set("key", API_KEY);

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`Google Books ${res.status}`);
    const data = await res.json() as { items?: GBVolume[] };
    const items = data.items ?? [];

    const books = items.map((vol) => {
      const info = vol.volumeInfo;
      // prefer https thumbnail, strip curl params
      const rawThumb = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? null;
      const cover_url = rawThumb ? rawThumb.replace(/^http:/, "https:") : null;
      const year = info.publishedDate ? info.publishedDate.slice(0, 4) : null;

      return {
        ol_key: vol.id,           // reuse same field name so page.tsx needs no change
        title: info.title,
        author: info.authors?.[0] ?? null,
        year: year ? Number(year) : null,
        publisher: info.publisher ?? null,
        cover_url,
        language: info.language ?? null,
      };
    });

    return NextResponse.json({ books });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "search failed" },
      { status: 502 }
    );
  }
}
