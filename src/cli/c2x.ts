#!/usr/bin/env npx tsx

import { readFile } from "node:fs/promises";
import { Command } from "commander";
import { planToBrief, planToBriefs, renderCodexBrief } from "@/core/brief";
import { mergeConfig } from "@/core/config";
import { DEMO_FILES } from "@/core/fixtures/demo-workspace";
import { packWorkspace } from "@/core/packer";
import { mockPlanFromPack } from "@/core/planner";
import { HARNESS_CATALOG, PROVIDER_CATALOG } from "@/core/providers/catalog";
import { routeExecuteTeam, routeRole } from "@/core/providers/router";
import { importControlMessage, runPlan, runRecord, runReview } from "@/core/run-loop";
import { estimateSavings } from "@/core/savings";
import { getSession } from "@/core/store";
import { formatTokens, formatUsd } from "@/core/tokens";
import {
  isExecutionExitStatus,
  isHarnessId,
  isPlannerChoice,
  isWorkspaceSource,
  resolveHarnessTeam,
  type PlannerChoice,
} from "@/core/types";

const program = new Command();
program.name("c2x").description("chat-to-x (CLI alias: c2x) — pack, plan on web chat, keep Codex / Claude Code / Grok Build / OpenCode / Kiro CLI thin.");

function teamFromOpts(opts: { team?: string; harness?: string }) {
  return resolveHarnessTeam({
    harnessTeam: opts.team,
    harness: opts.harness,
  });
}

program
  .command("providers")
  .description("List planner and harness catalogs")
  .action(() => {
    process.stdout.write("planners\n");
    for (const entry of PROVIDER_CATALOG) {
      process.stdout.write(
        `  ${entry.id.padEnd(20)} ${entry.kind.padEnd(14)} ${entry.quotaEn}\n`,
      );
    }
    process.stdout.write("harnesses (execute only; may share one plan)\n");
    for (const entry of HARNESS_CATALOG) {
      process.stdout.write(`  ${entry.id.padEnd(20)} harness         ${entry.quotaEn}\n`);
    }
  });

program
  .command("pack")
  .requiredOption("--goal <text>")
  .option("--budget <n>", "token budget", "4000")
  .action((opts: { goal: string; budget: string }) => {
    const pack = packWorkspace({
      goal: opts.goal,
      files: DEMO_FILES,
      budgetTokens: Number(opts.budget),
    });
    process.stdout.write(
      JSON.stringify(
        {
          rawTokens: pack.rawTokens,
          packedTokens: pack.packedTokens,
          excerpts: pack.excerpts.map((item) => item.path),
          omitted: pack.omittedFiles,
        },
        null,
        2,
      ) + "\n",
    );
  });

program
  .command("estimate")
  .requiredOption("--goal <text>")
  .option("--budget <n>", "token budget", "4000")
  .option("--team <ids>", "comma-separated harness ids")
  .option("--harness <id>", "single harness")
  .action((opts: { goal: string; budget: string; team?: string; harness?: string }) => {
    const team = teamFromOpts(opts);
    const pack = packWorkspace({
      goal: opts.goal,
      files: DEMO_FILES,
      budgetTokens: Number(opts.budget),
    });
    const plan = mockPlanFromPack(pack, "c2x_cli", team);
    const briefs = planToBriefs(plan);
    const brief = planToBrief(plan);
    const ledger = estimateSavings({ pack, brief, briefs, planner: "chatgpt-web" });
    process.stdout.write(
      [
        `raw=${formatTokens(pack.rawTokens)} packed=${formatTokens(pack.packedTokens)}`,
        `team=${team.join("+")} packets=${plan.packets.length}`,
        `briefs=${briefs.map((item) => `${item.owner}:${formatTokens(item.tokenEstimate)}`).join(",")}`,
        `saved=${Math.round(ledger.savedCodexPercent * 100)}% (${formatTokens(ledger.savedCodexTokens)})`,
        `usd ${formatUsd(ledger.c2xCostUsd)} vs ${formatUsd(ledger.naiveCostUsd)}`,
        "",
      ].join("\n"),
    );
  });

program
  .command("route")
  .option("--choice <id>", "planner choice", "auto")
  .option("--harness <id>", "single harness")
  .option("--team <ids>", "comma-separated harness ids")
  .action((opts: { choice: string; harness?: string; team?: string }) => {
    if (!isPlannerChoice(opts.choice)) {
      throw new Error(`unknown planner: ${opts.choice}`);
    }
    const team = teamFromOpts(opts);
    const config = mergeConfig({
      defaultHarness: team[0],
      defaultHarnessTeam: team,
    });
    for (const role of ["plan", "review"] as const) {
      const decision = routeRole({
        role,
        choice: opts.choice,
        harness: team[0],
        harnessTeam: team,
        config,
        hasKey: () => false,
      });
      process.stdout.write(`${role.padEnd(8)} -> ${decision.provider}\n`);
    }
    for (const decision of routeExecuteTeam(team)) {
      process.stdout.write(`execute  -> ${decision.provider}\n`);
    }
  });

program
  .command("plan")
  .requiredOption("--goal <text>")
  .option("--planner <id>", "auto|mock|chatgpt-web|claude-web|gemini-web|…", "mock")
  .option("--harness <id>", "single harness")
  .option("--team <ids>", "comma-separated harness ids")
  .option("--budget <n>", "token budget", "4000")
  .option("--workspace <src>", "demo|repo", "demo")
  .action(async (opts: {
    goal: string;
    planner: string;
    harness?: string;
    team?: string;
    budget: string;
    workspace: string;
  }) => {
    if (!isPlannerChoice(opts.planner)) {
      throw new Error(`unknown planner: ${opts.planner}`);
    }
    if (!isWorkspaceSource(opts.workspace)) {
      throw new Error(`unknown workspace: ${opts.workspace}`);
    }
    const harnessTeam = teamFromOpts(opts);
    const session = await runPlan({
      goal: opts.goal,
      plannerChoice: opts.planner as PlannerChoice,
      harnessTeam,
      budgetTokens: Number(opts.budget),
      workspaceSource: opts.workspace,
    });
    if (session.briefs.length > 0) {
      for (const brief of session.briefs) {
        process.stdout.write(`\n--- ${brief.owner} ---\n`);
        process.stdout.write(renderCodexBrief(brief));
      }
    } else if (session.pastePrompt) {
      process.stdout.write(session.pastePrompt);
      process.stdout.write("\n");
    } else {
      process.stdout.write(`${session.id} ${session.state}\n`);
    }
  });

program
  .command("import")
  .requiredOption("--session <id>")
  .requiredOption("--raw-file <path>", "path to a [C2X] block, or - for stdin")
  .action(async (opts: { session: string; rawFile: string }) => {
    const raw =
      opts.rawFile === "-"
        ? await new Promise<string>((resolve, reject) => {
            const chunks: Buffer[] = [];
            process.stdin.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
            process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
            process.stdin.on("error", reject);
          })
        : await readFile(opts.rawFile, "utf8");
    const session = await importControlMessage({ sessionId: opts.session, raw });
    process.stdout.write(`${session.id} ${session.state}\n`);
  });

program
  .command("record")
  .requiredOption("--session <id>")
  .requiredOption("--owner <id>")
  .option("--cwd <path>", "workspace root (CLI only)")
  .option("--tests <text>")
  .option("--exit-status <status>", "ok|fail|unknown")
  .action(async (opts: {
    session: string;
    owner: string;
    cwd?: string;
    tests?: string;
    exitStatus?: string;
  }) => {
    if (!isHarnessId(opts.owner)) {
      throw new Error(`unknown harness: ${opts.owner}`);
    }
    if (opts.exitStatus && !isExecutionExitStatus(opts.exitStatus)) {
      throw new Error(`unknown exit-status: ${opts.exitStatus}`);
    }
    const session = await runRecord({
      sessionId: opts.session,
      owner: opts.owner,
      cwd: opts.cwd,
      tests: opts.tests,
      exitStatus:
        opts.exitStatus && isExecutionExitStatus(opts.exitStatus) ? opts.exitStatus : undefined,
    });
    process.stdout.write(`${session.id} ${session.state} ${opts.owner}\n`);
  });

program
  .command("review-prompt")
  .requiredOption("--session <id>")
  .action(async (opts: { session: string }) => {
    const existing = await getSession(opts.session);
    if (!existing) {
      throw new Error(`unknown session: ${opts.session}`);
    }
    const session =
      existing.reviewPastePrompt && existing.state === "REVIEW"
        ? existing
        : await runReview({
            sessionId: opts.session,
            changedFiles: [],
            tests: "not run",
          });
    if (!session.reviewPastePrompt) {
      throw new Error("No review paste prompt. Use a web/subscription planner.");
    }
    process.stdout.write(session.reviewPastePrompt);
    process.stdout.write("\n");
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "c2x failed";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
