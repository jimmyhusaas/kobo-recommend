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
