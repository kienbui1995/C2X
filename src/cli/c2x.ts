#!/usr/bin/env npx tsx

import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Command } from "commander";
import { planToBrief, planToBriefs, renderCodexBrief } from "@/core/brief";
import { mergeConfig } from "@/core/config";
import { DEMO_FILES } from "@/core/fixtures/demo-workspace";
import {
  detectHarnessTeam,
  installSkill,
  writeHarnessBrief,
  writeWorkspaceBriefDrop,
} from "@/core/harness";
import { DEFAULT_INIT_GOAL, formatInitReport, runInit } from "@/core/init";
import { packWorkspace } from "@/core/packer";
import { mockPlanFromPack } from "@/core/planner";
import { HARNESS_CATALOG, PROVIDER_CATALOG } from "@/core/providers/catalog";
import { routeExecuteTeam, routeRole } from "@/core/providers/router";
import { handoffMessage, nextExpectedStep } from "@/core/protocol";
import { formatDriveReport, runDrive } from "@/core/drive";
import { importControlMessage, runPlan, runRecord, runReview } from "@/core/run-loop";
import { describeSessionStatus, formatSessionStatus } from "@/core/session-status";
import { estimateSavings } from "@/core/savings";
import {
  MCP_LOOPBACK_HOST,
  MCP_LOOPBACK_PORT,
  assertLoopbackBind,
  createMcpLoopbackServer,
} from "@/core/mcp-loopback";
import { dataDir, getSession, loadSessions, resolveSessionRecord } from "@/core/store";
import { resolveWorkspaceRoot } from "@/core/workspace";
import { formatTokens, formatUsd } from "@/core/tokens";
import {
  HARNESS_IDS,
  isExecutionExitStatus,
  isHarnessId,
  isPlannerChoice,
  isWorkspaceSource,
  resolveHarnessTeam,
  type PlannerChoice,
} from "@/core/types";

const SIMPLE_USAGE = [
  "Cài một lần (trong thư mục chat-to-x):  npm install && npm link",
  "Trong project cần sửa:                 c2x \"Sửa createTask\"",
  "ChatGPT: dán file outbox, lưu trả lời vào .c2x/inbox.md",
  "",
].join("\n");

const program = new Command();
program.name("c2x").description("chat-to-x — ChatGPT nghĩ, Codex chạy. Gõ: c2x \"mục tiêu\"");

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
  .option("--cwd <path>", "workspace root for repo pack + brief drops (CLI only)")
  .action(async (opts: {
    goal: string;
    planner: string;
    harness?: string;
    team?: string;
    budget: string;
    workspace: string;
    cwd?: string;
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
      cwd: opts.cwd,
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

program
  .command("status")
  .description("Show a session and the next protocol step (latest if omitted)")
  .option("--session <id>", "session id")
  .action(async (opts: { session?: string }) => {
    const session = await resolveSessionRecord(opts.session);
    if (!session) {
      process.stdout.write("(none)\n");
      return;
    }
    process.stdout.write(formatSessionStatus(describeSessionStatus(session)));
  });

program
  .command("sessions")
  .description("List local C2X sessions")
  .action(async () => {
    const sessions = await loadSessions();
    if (sessions.length === 0) {
      process.stdout.write("(none)\n");
      return;
    }
    for (const session of sessions) {
      process.stdout.write(
        `${session.id} ${session.state} ${session.planner} ${session.harnessTeam.join(",")}\n`,
      );
    }
  });

program
  .command("doctor")
  .option("--team <ids>", "comma-separated harness ids")
  .action(async (opts: { team?: string }) => {
    const team = opts.team ? teamFromOpts(opts) : [...HARNESS_IDS];
    const results = await detectHarnessTeam(team);
    for (const result of results) {
      const status = result.ok ? "ok" : "missing";
      const detail = result.ok ? (result.binary ?? "") : result.hintVi;
      process.stdout.write(`${result.id}\t${status}\t${detail}\n`);
    }
  });

program
  .command("brief")
  .requiredOption("--session <id>")
  .requiredOption("--owner <id>")
  .option("--drop", "also write .c2x/briefs/<owner>.md in the workspace", false)
  .option("--cwd <path>", "workspace root for --drop (CLI only)")
  .action(async (opts: { session: string; owner: string; drop?: boolean; cwd?: string }) => {
    if (!isHarnessId(opts.owner)) {
      throw new Error(`unknown harness: ${opts.owner}`);
    }
    const session = await getSession(opts.session);
    if (!session) {
      throw new Error(`unknown session: ${opts.session}`);
    }
    const briefPath = await writeHarnessBrief({
      session,
      owner: opts.owner,
      dataDir: dataDir(),
    });
    process.stdout.write(`${briefPath}\n`);
    if (opts.drop) {
      const dropPath = await writeWorkspaceBriefDrop({
        workspaceRoot: resolveWorkspaceRoot({ cwd: opts.cwd, env: process.env }),
        session,
        owner: opts.owner,
      });
      process.stdout.write(`${dropPath}\n`);
    }
  });

program
  .command("handoff")
  .requiredOption("--session <id>")
  .action(async (opts: { session: string }) => {
    const session = await getSession(opts.session);
    if (!session) {
      throw new Error(`unknown session: ${opts.session}`);
    }
    const raw = handoffMessage({
      taskId: session.id,
      iteration: session.plan?.iteration ?? 0,
      originalGoal: session.goal,
      progress: session.events.at(-1)?.note || session.state,
      currentState: session.state,
      knownIssues: session.review?.issues.join("; ") || session.fallbackReason || "none",
      nextExpectedStep: nextExpectedStep(session.state),
    });
    process.stdout.write(raw);
    if (!raw.endsWith("\n")) {
      process.stdout.write("\n");
    }
  });

program
  .command("mcp")
  .description("Read-only loopback MCP on 127.0.0.1 (no tunnel, no OAuth)")
  .requiredOption("--session <id>")
  .option("--port <n>", "loopback port", String(MCP_LOOPBACK_PORT))
  .action(async (opts: { session: string; port: string }) => {
    assertLoopbackBind(MCP_LOOPBACK_HOST);
    const existing = await getSession(opts.session);
    if (!existing) {
      throw new Error(`unknown session: ${opts.session}`);
    }
    const server = createMcpLoopbackServer({
      getSession: (id) => getSession(id),
    });
    const port = Number(opts.port) || MCP_LOOPBACK_PORT;
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, MCP_LOOPBACK_HOST, () => {
        process.stdout.write(
          `c2x mcp ${existing.id} http://${MCP_LOOPBACK_HOST}:${port}/ (read-only, no tunnel)\n`,
        );
        resolve();
      });
    });
  });

program
  .command("drive", { isDefault: true })
  .alias("go")
  .description("ChatGPT nghĩ, Codex chạy — mặc định. c2x \"mục tiêu\"")
  .argument("[goal]", "mục tiêu")
  .option("--goal <text>", "mục tiêu (nếu không ghi sau c2x)")
  .option("--session <id>", "resume an existing session")
  .option("--planner <id>", "chatgpt-web|mock|openai|…", "chatgpt-web")
  .option("--team <ids>", "comma-separated harness ids")
  .option("--harness <id>", "single harness (mặc định: codex)")
  .option("--cwd <path>", "workspace root (CLI only)")
  .option("--workspace <src>", "demo|repo", "repo")
  .option("--budget <n>", "token budget", "4000")
  .option("--spawn", "start each harness from PATH (default)", true)
  .option("--no-spawn", "do not spawn; leave briefs for a human")
  .option("--timeout <ms>", "inbox + spawn timeout", "900000")
  .action(async (
    goalArg: string | undefined,
    opts: {
      goal?: string;
      session?: string;
      planner: string;
      team?: string;
      harness?: string;
      cwd?: string;
      workspace: string;
      budget: string;
      spawn?: boolean;
      timeout: string;
    },
  ) => {
    const goal = goalArg?.trim() || opts.goal?.trim();
    if (!goal && !opts.session) {
      process.stdout.write(SIMPLE_USAGE);
      return;
    }
    if (!isPlannerChoice(opts.planner)) {
      throw new Error(`unknown planner: ${opts.planner}`);
    }
    if (!isWorkspaceSource(opts.workspace)) {
      throw new Error(`unknown workspace: ${opts.workspace}`);
    }
    if (opts.harness && !isHarnessId(opts.harness)) {
      throw new Error(`unknown harness: ${opts.harness}`);
    }
    const result = await runDrive({
      goal,
      sessionId: opts.session,
      plannerChoice: opts.planner,
      harnessTeam: opts.team ? teamFromOpts(opts) : undefined,
      harness: opts.harness && isHarnessId(opts.harness) ? opts.harness : undefined,
      workspaceSource: opts.workspace,
      budgetTokens: Number(opts.budget),
      cwd: opts.cwd,
      spawn: opts.spawn !== false,
      timeoutMs: Number(opts.timeout),
    });
    process.stdout.write(formatDriveReport(result));
  });

program
  .command("init")
  .description("Install skill, run doctor, mock-plan, drop briefs (no spawn)")
  .option("--goal <text>", "mock PLAN goal", DEFAULT_INIT_GOAL)
  .option("--team <ids>", "comma-separated harness ids")
  .option("--harness <id>", "single harness")
  .option("--cwd <path>", "workspace root for brief drops (CLI only)")
  .option("--workspace <src>", "demo|repo", "demo")
  .option("--budget <n>", "token budget", "4000")
  .action(async (opts: {
    goal: string;
    team?: string;
    harness?: string;
    cwd?: string;
    workspace: string;
    budget: string;
  }) => {
    if (!isWorkspaceSource(opts.workspace)) {
      throw new Error(`unknown workspace: ${opts.workspace}`);
    }
    if (opts.harness && !isHarnessId(opts.harness)) {
      throw new Error(`unknown harness: ${opts.harness}`);
    }
    const result = await runInit({
      goal: opts.goal,
      harnessTeam: opts.team ? teamFromOpts(opts) : undefined,
      harness: opts.harness && isHarnessId(opts.harness) ? opts.harness : undefined,
      workspaceSource: opts.workspace,
      cwd: opts.cwd,
      repoRoot: process.cwd(),
      skillHome: path.join(os.homedir(), ".codex/skills"),
      budgetTokens: Number(opts.budget),
    });
    process.stdout.write(formatInitReport(result));
  });

program
  .command("skill-install")
  .description("Copy the chat-to-x skill into ~/.codex/skills/chat-to-x/")
  .action(async () => {
    const dest = await installSkill({
      repoRoot: process.cwd(),
      skillHome: path.join(os.homedir(), ".codex/skills"),
    });
    process.stdout.write(`${dest}\n`);
    process.stdout.write(
      "Claude Code: copy the same SKILL.md to ~/.claude/skills/chat-to-x/ (C2X does not auto-install there).\n",
    );
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "c2x failed";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
