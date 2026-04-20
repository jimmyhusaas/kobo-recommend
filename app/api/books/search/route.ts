import { NextRequest, NextResponse } from "next/server";

type OLDoc = {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  publisher?: string[];
  isbn?: string[];
  cover_i?: number;
};

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "q required" }, { status: 400 });

  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=8&fields=key,title,author_name,first_publish_year,publisher,isbn,cover_i`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "KoboRecommend/1.0 (personal reading tracker)" },
      next: { revalidate: 3600 }, // cache 1 hour
    });
    if (!res.ok) throw new Error(`Open Library ${res.status}`);
    const data = await res.json() as { docs: OLDoc[] };

    const books = (data.docs ?? []).map((doc) => ({
      ol_key: doc.key,
      title: doc.title,
      author: doc.author_name?.[0] ?? null,
      year: doc.first_publish_year ?? null,
      publisher: doc.publisher?.[0] ?? null,
      cover_url: doc.cover_i
        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
        : null,
    }));

    return NextResponse.json({ books });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "search failed" },
      { status: 502 }
    );
  }
}
