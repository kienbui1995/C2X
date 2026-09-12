import { NextResponse } from "next/server";
import { runRecord } from "@/core/run-loop";
import { isExecutionExitStatus, isHarnessId } from "@/core/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionId?: string;
      owner?: string;
      changedFiles?: string[];
      tests?: string;
      exitStatus?: string;
      cwd?: string;
      workspaceRoot?: string;
    };
    if (!body.sessionId?.trim()) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }
    if (!body.owner || !isHarnessId(body.owner)) {
      return NextResponse.json({ error: "unknown harness" }, { status: 400 });
    }
    const session = await runRecord({
      sessionId: body.sessionId,
      owner: body.owner,
      changedFiles: Array.isArray(body.changedFiles) ? body.changedFiles : undefined,
      tests: body.tests,
      exitStatus: body.exitStatus && isExecutionExitStatus(body.exitStatus) ? body.exitStatus : undefined,
    });
    return NextResponse.json({ session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "record failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
