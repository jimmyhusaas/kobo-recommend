import { NextRequest, NextResponse } from "next/server";
import { sql, DEFAULT_USER_ID } from "@/lib/db";

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.pathname.split("/").pop()!;

  const result = await sql`
    DELETE FROM books_read
    WHERE id = ${id} AND user_id = ${DEFAULT_USER_ID}
    RETURNING id
  ` as unknown as Array<{ id: string }>;

  if (result.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({ deleted: id });
}

const VALID_RATINGS = ["liked", "neutral", "disliked", null];
const VALID_READING_STATUS = ["read", "to_read"];

export async function PATCH(req: NextRequest) {
  const id = req.nextUrl.pathname.split("/").pop()!;

  let body: { exclude_from_analysis?: boolean; rating?: string | null; reading_status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // 更新 reading_status
  if ("reading_status" in body) {
    if (!VALID_READING_STATUS.includes(body.reading_status ?? "")) {
      return NextResponse.json({ error: "invalid reading_status" }, { status: 400 });
    }
    const result = await sql`
      UPDATE books_read
      SET reading_status = ${body.reading_status!}
      WHERE id = ${id} AND user_id = ${DEFAULT_USER_ID}
      RETURNING id, reading_status
    ` as unknown as Array<{ id: string; reading_status: string }>;

    if (result.length === 0) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json(result[0]);
  }

  // 更新 rating
  if ("rating" in body) {
    if (!VALID_RATINGS.includes(body.rating ?? null)) {
      return NextResponse.json({ error: "invalid rating" }, { status: 400 });
    }
    const result = await sql`
      UPDATE books_read
      SET rating = ${body.rating ?? null}
      WHERE id = ${id} AND user_id = ${DEFAULT_USER_ID}
      RETURNING id, rating
    ` as unknown as Array<{ id: string; rating: string | null }>;

    if (result.length === 0) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json(result[0]);
  }

  // 更新 exclude_from_analysis
  if (typeof body.exclude_from_analysis !== "boolean") {
    return NextResponse.json({ error: "exclude_from_analysis (boolean) required" }, { status: 400 });
  }

  const result = await sql`
    UPDATE books_read
    SET exclude_from_analysis = ${body.exclude_from_analysis}
    WHERE id = ${id} AND user_id = ${DEFAULT_USER_ID}
    RETURNING id, exclude_from_analysis
  ` as unknown as Array<{ id: string; exclude_from_analysis: boolean }>;

  if (result.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json(result[0]);
}
