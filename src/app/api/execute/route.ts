import { NextResponse } from "next/server";
import { runExecute } from "@/core/run-loop";
import { isHarnessId } from "@/core/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionId?: string;
      harness?: string;
      all?: boolean;
      changedFiles?: string[];
      tests?: string;
    };
    if (!body.sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }
    if (!body.all && body.harness && !isHarnessId(body.harness)) {
      return NextResponse.json({ error: "unknown harness" }, { status: 400 });
    }
    const session = await runExecute({
      sessionId: body.sessionId,
      harness: body.harness && isHarnessId(body.harness) ? body.harness : undefined,
      all: Boolean(body.all),
      changedFiles: Array.isArray(body.changedFiles) ? body.changedFiles : undefined,
      tests: body.tests,
    });
    return NextResponse.json({ session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "execute failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
