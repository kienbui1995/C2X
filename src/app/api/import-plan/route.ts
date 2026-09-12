import { NextResponse } from "next/server";
import { importPlan } from "@/core/run-loop";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { sessionId?: string; raw?: string };
    if (!body.raw?.trim()) {
      return NextResponse.json({ error: "raw plan is required" }, { status: 400 });
    }
    const session = await importPlan({
      sessionId: body.sessionId,
      raw: body.raw,
    });
    return NextResponse.json({ session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "import failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
