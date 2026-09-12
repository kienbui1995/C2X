import { NextResponse } from "next/server";
import { clampBudget } from "@/core/tokens";
import { isHarnessId, isPlannerChoice, isWorkspaceSource } from "@/core/types";
import { runPlan } from "@/core/run-loop";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      goal?: string;
      plannerChoice?: string;
      harness?: string;
      harnessTeam?: string[];
      budgetTokens?: number;
      workspaceSource?: string;
      allowFallback?: boolean;
    };
    const goal = body.goal?.trim();
    if (!goal) {
      return NextResponse.json({ error: "goal is required" }, { status: 400 });
    }
    const plannerChoice = body.plannerChoice ?? "auto";
    if (!isPlannerChoice(plannerChoice)) {
      return NextResponse.json({ error: "unknown planner" }, { status: 400 });
    }
    const workspaceSource = body.workspaceSource ?? "demo";
    if (!isWorkspaceSource(workspaceSource)) {
      return NextResponse.json({ error: "unknown workspace" }, { status: 400 });
    }
    if (body.harness && !isHarnessId(body.harness)) {
      return NextResponse.json({ error: "unknown harness" }, { status: 400 });
    }
    if (body.harnessTeam?.some((id) => !isHarnessId(id))) {
      return NextResponse.json({ error: "unknown harness" }, { status: 400 });
    }
    const session = await runPlan({
      goal,
      plannerChoice,
      harness: body.harness && isHarnessId(body.harness) ? body.harness : undefined,
      harnessTeam: body.harnessTeam?.filter(isHarnessId),
      budgetTokens: clampBudget(Number(body.budgetTokens) || 4000),
      workspaceSource,
      allowFallback: body.allowFallback ?? true,
    });
    return NextResponse.json({ session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "plan failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
