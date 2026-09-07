import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await pool.query("SELECT 1");
    return NextResponse.json({ ok: true, service: "mubsme", db: "up" });
  } catch {
    return NextResponse.json(
      { ok: false, service: "mubsme", db: "down" },
      { status: 503 },
    );
  }
}
