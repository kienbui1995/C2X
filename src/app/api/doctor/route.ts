import { NextResponse } from "next/server";
import { detectCodexHooks } from "@/core/codex-config";
import { detectHarnessTeam } from "@/core/harness";
import { HARNESS_IDS, isHarnessId } from "@/core/types";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const teamRaw = url.searchParams.get("team");
  const team = teamRaw
    ? teamRaw
        .split(",")
        .map((item) => item.trim())
        .filter(isHarnessId)
    : [...HARNESS_IDS];
  const doctor = await detectHarnessTeam(team.length > 0 ? team : [...HARNESS_IDS]);
  const hooks = await detectCodexHooks();
  return NextResponse.json({ doctor, hooks });
}
