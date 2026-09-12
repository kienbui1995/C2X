#!/usr/bin/env npx tsx

import { Command } from "commander";
import { planToBrief, renderCodexBrief } from "@/core/brief";
import { mergeConfig } from "@/core/config";
import { DEMO_FILES } from "@/core/fixtures/demo-workspace";
import { packWorkspace } from "@/core/packer";
import { mockPlanFromPack } from "@/core/planner";
import { PROVIDER_CATALOG } from "@/core/providers/catalog";
import { routeRole } from "@/core/providers/router";
import { runPlan } from "@/core/run-loop";
import { estimateSavings } from "@/core/savings";
import { formatTokens, formatUsd } from "@/core/tokens";
import { isPlannerChoice, isWorkspaceSource, type PlannerChoice } from "@/core/types";

const program = new Command();
program.name("c2x").description("Frugal Codex — pack, plan, keep Codex thin.");

program
  .command("providers")
  .description("List planner catalog")
  .action(() => {
    for (const entry of PROVIDER_CATALOG) {
      process.stdout.write(
        `${entry.id.padEnd(20)} ${entry.kind.padEnd(14)} $${entry.usdPerMillionIn}/1M  ${entry.name}\n`,
      );
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
  .action((opts: { goal: string; budget: string }) => {
    const pack = packWorkspace({
      goal: opts.goal,
      files: DEMO_FILES,
      budgetTokens: Number(opts.budget),
    });
    const plan = mockPlanFromPack(pack, "c2x_cli");
    const brief = planToBrief(plan);
    const ledger = estimateSavings({ pack, brief, planner: "chatgpt-web" });
    process.stdout.write(
      [
        `raw=${formatTokens(pack.rawTokens)} packed=${formatTokens(pack.packedTokens)}`,
        `codex_brief=${formatTokens(brief.tokenEstimate)}`,
        `saved=${Math.round(ledger.savedCodexPercent * 100)}% (${formatTokens(ledger.savedCodexTokens)})`,
        `usd ${formatUsd(ledger.c2xCostUsd)} vs ${formatUsd(ledger.naiveCostUsd)}`,
        "",
      ].join("\n"),
    );
  });

program
  .command("route")
  .option("--choice <id>", "planner choice", "auto")
  .action((opts: { choice: string }) => {
    if (!isPlannerChoice(opts.choice)) {
      throw new Error(`unknown planner: ${opts.choice}`);
    }
    const config = mergeConfig();
    for (const role of ["plan", "review", "execute"] as const) {
      const decision = routeRole({
        role,
        choice: opts.choice,
        config,
        hasKey: () => false,
      });
      process.stdout.write(`${role.padEnd(8)} -> ${decision.provider}\n`);
    }
  });

program
  .command("plan")
  .requiredOption("--goal <text>")
  .option("--planner <id>", "auto|mock|chatgpt-web|…", "mock")
  .option("--budget <n>", "token budget", "4000")
  .option("--workspace <src>", "demo|repo", "demo")
  .action(async (opts: { goal: string; planner: string; budget: string; workspace: string }) => {
    if (!isPlannerChoice(opts.planner)) {
      throw new Error(`unknown planner: ${opts.planner}`);
    }
    if (!isWorkspaceSource(opts.workspace)) {
      throw new Error(`unknown workspace: ${opts.workspace}`);
    }
    const session = await runPlan({
      goal: opts.goal,
      plannerChoice: opts.planner as PlannerChoice,
      budgetTokens: Number(opts.budget),
      workspaceSource: opts.workspace,
    });
    if (session.brief) {
      process.stdout.write(renderCodexBrief(session.brief));
    } else if (session.pastePrompt) {
      process.stdout.write(session.pastePrompt);
      process.stdout.write("\n");
    } else {
      process.stdout.write(`${session.id} ${session.state}\n`);
    }
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "c2x failed";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
