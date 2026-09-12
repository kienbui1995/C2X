import { NextResponse } from "next/server";
import { runReview } from "@/core/run-loop";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionId?: string;
      changedFiles?: string[];
      tests?: string;
    };
    if (!body.sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }
    const session = await runReview({
      sessionId: body.sessionId,
      changedFiles: Array.isArray(body.changedFiles) ? body.changedFiles : [],
      tests: body.tests?.trim() || "not run",
    });
    return NextResponse.json({ session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "review failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
