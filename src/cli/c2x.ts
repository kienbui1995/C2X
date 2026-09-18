#!/usr/bin/env npx tsx

import { readFile } from "node:fs/promises";
import { Command } from "commander";
import { planToBrief, planToBriefs, renderCodexBrief } from "@/core/brief";
import { mergeConfig } from "@/core/config";
import { DEMO_FILES } from "@/core/fixtures/demo-workspace";
import {
  chatToXMcpLaunch,
  defaultCodexAgentsPath,
  defaultCodexConfigPath,
  defaultSkillHomes,
  detectCodexHooks,
  installCodexAgents,
  installCodexMcp,
} from "@/core/codex-config";
import {
  detectHarnessTeam,
  installSkills,
  writeHarnessBrief,
  writeWorkspaceBriefDrop,
} from "@/core/harness";
import { DEFAULT_INIT_GOAL, formatInitReport, runInit } from "@/core/init";
import { packageRoot } from "@/core/package-root";
import { packWorkspace } from "@/core/packer";
import { mockPlanFromPack } from "@/core/planner";
import { getHarness, HARNESS_CATALOG, PROVIDER_CATALOG } from "@/core/providers/catalog";
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
import { runMcpStdio } from "@/core/mcp-stdio";
import { dataDir, getSession, loadSessions, resolveSessionRecord } from "@/core/store";
import { resolveWorkspaceRoot } from "@/core/workspace";
import { formatTokens, formatUsd } from "@/core/tokens";
import {
  HARNESS_IDS,
  PIPELINE_AGY_HARNESS_TEAM,
  PIPELINE_HARNESS_TEAM,
  brainFromFlags,
  isExecutionExitStatus,
  isHarnessId,
  isPlannerChoice,
  isWorkspaceSource,
  resolveHarnessTeam,
  type PlannerChoice,
} from "@/core/types";

const SIMPLE_USAGE = [
  "Cài một lệnh:  curl -fsSL https://raw.githubusercontent.com/kienbui1995/C2X/main/install.sh | bash",
  "Hoặc trong checkout:  ./install.sh",
  "Dùng:  cd <project> && codex",
  "Gõ:    Dùng C2X, tự làm hết: <mô tả>",
  "Trong Codex: /mcp hoặc $chat-to-x — không có banner C2X.",
  "",
].join("\n");
