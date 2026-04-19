import { NextRequest, NextResponse } from "next/server";
import { sql, DEFAULT_USER_ID } from "@/lib/db";

const ALLOWED = ["pending", "read", "rejected", "skipped"] as const;
type Status = (typeof ALLOWED)[number];

function isStatus(s: unknown): s is Status {
  return typeof s === "string" && (ALLOWED as readonly string[]).includes(s);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: { status?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!isStatus(body.status)) {
    return NextResponse.json(
      { error: `status must be one of ${ALLOWED.join("/")}` },
      { status: 400 }
    );
  }

  const result = (await sql`
    UPDATE recommendations
    SET status = ${body.status}
    WHERE id = ${id} AND user_id = ${DEFAULT_USER_ID}
    RETURNING id, status
  `) as unknown as Array<{ id: string; status: string }>;

  if (result.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json(result[0]);
}
