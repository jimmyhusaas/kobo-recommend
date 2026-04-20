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
  url.searchParams.set("langRestrict", "zh");   // 中文優先
  if (API_KEY) url.searchParams.set("key", API_KEY);

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`Google Books ${res.status}`);
    const data = await res.json() as { items?: GBVolume[] };

    // 如果中文搜尋沒結果，fallback 不限語言再搜一次
    let items = data.items ?? [];
    if (items.length === 0) {
      const url2 = new URL("https://www.googleapis.com/books/v1/volumes");
      url2.searchParams.set("q", q);
      url2.searchParams.set("maxResults", "10");
      url2.searchParams.set("printType", "books");
      if (API_KEY) url2.searchParams.set("key", API_KEY);
      const res2 = await fetch(url2.toString(), { next: { revalidate: 3600 } });
      if (res2.ok) {
        const data2 = await res2.json() as { items?: GBVolume[] };
        items = data2.items ?? [];
      }
    }

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
