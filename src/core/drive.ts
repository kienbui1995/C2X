import { persistWorkspaceBriefs } from "@/core/harness";
import { writeOutboxFile, waitForInboxControl } from "@/core/mailbox";
import { isPastePlanner } from "@/core/providers/catalog";
import { importControlMessage, runPlan, runRecord, runReview } from "@/core/run-loop";
import { spawnHarness, type HarnessSpawnResult, type SpawnHarnessFn } from "@/core/spawn-harness";
import { getSession } from "@/core/store";
import { resolveWorkspaceRoot } from "@/core/workspace";
import {
  assertNever,
  resolveBrainTeam,
  resolveSessionBrain,
  type HarnessId,
  type PlannerChoice,
  type SessionBrain,
  type SessionRecord,
  type WorkspaceSource,
} from "@/core/types";

export type DriveWaitFn = (session: SessionRecord, workspaceRoot: string) => Promise<string>;

export type DriveResult = {
  session: SessionRecord;
  outbox: string[];
  spawns: HarnessSpawnResult[];
};

export async function runDrive(input: {
  goal?: string;
  sessionId?: string;
  plannerChoice?: PlannerChoice;
  harnessTeam?: readonly HarnessId[];
  harness?: HarnessId;
  workspaceSource?: WorkspaceSource;
  budgetTokens?: number;
  cwd?: string;
  spawn?: boolean;
  timeoutMs?: number;
  waitForControl?: DriveWaitFn;
  spawnHarness?: SpawnHarnessFn;
  brain?: SessionBrain;
}): Promise<DriveResult> {
  const workspaceRoot = resolveWorkspaceRoot({ cwd: input.cwd, env: process.env });
  const spawnEnabled = input.spawn !== false;
  const waitForControl =
    input.waitForControl ??
    ((_: SessionRecord, root: string) =>
      waitForInboxControl({ workspaceRoot: root, timeoutMs: input.timeoutMs }));
  const runSpawn = input.spawnHarness ?? spawnHarness;
  const outbox: string[] = [];
  const spawns: HarnessSpawnResult[] = [];

  let session = input.sessionId ? await getSession(input.sessionId) : null;
  if (!session) {
    session = await runPlan({
      goal: input.goal ?? "Drive the C2X loop",
      plannerChoice: input.plannerChoice ?? "chatgpt-web",
      harnessTeam: resolveBrainTeam({
        brain: input.brain,
        harnessTeam: input.harnessTeam,
        harness: input.harness,
        fallbackTeam: ["codex"],
      }),
      budgetTokens: input.budgetTokens ?? 4000,
      workspaceSource: input.workspaceSource ?? "repo",
      cwd: input.cwd,
      brain: input.brain,
    });
  }

  for (let step = 0; step < 12; step += 1) {
    switch (session.state) {
      case "INIT": {
        if (session.pastePrompt) {
          outbox.push(await writeOutboxFile(workspaceRoot, "plan-prompt.md", session.pastePrompt));
          const raw = await waitForControl(session, workspaceRoot);
          session = await importControlMessage({ sessionId: session.id, raw });
          break;
        }
        throw new Error("Session is INIT without a paste prompt. Re-run plan.");
      }
      case "PLAN":
      case "EXECUTING": {
        const active = session;
        if (!active) {
          throw new Error("Session is missing.");
        }
        await persistWorkspaceBriefs(active, input.cwd);
        const pending = active.harnessRuns.filter((run) => run.state !== "executed");
        const spawnable = pending.filter((run) => !shouldSkipBrainSpawn(active, run.owner));
        if (pending.length === 0) {
          session = await runReview({
            sessionId: session.id,
            changedFiles: session.records.flatMap((item) => item.changedFiles),
            tests: session.records.map((item) => item.tests).join("\n") || "recorded",
          });
          break;
        }
        if (!spawnEnabled || spawnable.length === 0) {
          return { session, outbox, spawns };
        }
        for (const run of spawnable) {
          const spawned = await runSpawn({
            owner: run.owner,
            workspaceRoot,
            timeoutMs: input.timeoutMs,
          });
          spawns.push(spawned);
          session = await runRecord({
            sessionId: session.id,
            owner: run.owner,
            cwd: input.cwd,
            exitStatus: spawned.skipped ? "unknown" : spawned.exitCode === 0 ? "ok" : "fail",
            tests: spawned.skipped
              ? spawned.reason ?? "skipped"
              : spawned.exitCode === 0
                ? "recorded"
                : `exit ${spawned.exitCode}`,
          });
        }
        break;
      }
      case "EXECUTED": {
        session = await runReview({
          sessionId: session.id,
          changedFiles: session.records.flatMap((item) => item.changedFiles),
          tests: session.records.map((item) => item.tests).join("\n") || "recorded",
        });
        break;
      }
      case "REVIEW": {
        if (session.review) {
          return { session, outbox, spawns };
        }
        if (isPastePlanner(session.planner) && session.reviewPastePrompt) {
          outbox.push(
            await writeOutboxFile(workspaceRoot, "review-prompt.md", session.reviewPastePrompt),
          );
          const raw = await waitForControl(session, workspaceRoot);
          session = await importControlMessage({ sessionId: session.id, raw });
          break;
        }
        throw new Error("REVIEW has no verdict and no paste prompt.");
      }
      case "DONE":
      case "BLOCKED":
      case "ERROR":
      case "HANDOFF":
        return { session, outbox, spawns };
      default:
        return assertNever(session.state, `Unhandled drive state: ${session.state}`);
    }
  }
  return { session, outbox, spawns };
}

function shouldSkipBrainSpawn(session: SessionRecord, owner: HarnessId): boolean {
  const brain = resolveSessionBrain(session.brain);
  switch (brain) {
    case "none":
      return false;
    case "codex":
    case "agy":
      return owner === brain;
    default:
      return assertNever(brain, `Unknown session brain: ${brain}`);
  }
}

export function formatDriveReport(result: DriveResult): string {
  const spawnLines =
    result.spawns.length > 0
      ? result.spawns.map((item) => {
          const status = item.skipped ? "skipped" : `exit ${item.exitCode}`;
          return `  ${item.owner}\t${status}\t${item.command}`;
        })
      : ["  (none)"];
  const outboxLines =
    result.outbox.length > 0 ? result.outbox.map((item) => `  ${item}`) : ["  (none)"];
  return [
    `session\t${result.session.id} ${result.session.state} ${result.session.planner}`,
    "outbox",
    ...outboxLines,
    "spawns",
    ...spawnLines,
    result.outbox[0]
      ? `Dán ${result.outbox[0]} vào ChatGPT. Lưu trả lời vào .c2x/inbox.md`
      : "Không cần dán chat web.",
    "",
  ].join("\n");
}
