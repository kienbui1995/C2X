import { NextResponse } from "next/server";
import { loadSessions } from "@/core/store";

export async function GET() {
  const sessions = await loadSessions();
  return NextResponse.json({ sessions });
}
