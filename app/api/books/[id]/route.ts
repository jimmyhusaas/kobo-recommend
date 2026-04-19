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

export async function PATCH(req: NextRequest) {
  const id = req.nextUrl.pathname.split("/").pop()!;

  let body: { exclude_from_analysis?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

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
