export const PROVIDER_IDS = [
  "mock",
  "chatgpt-web",
  "claude-web",
  "gemini-web",
  "openai",
  "anthropic",
  "gemini",
  "groq",
  "openrouter",
  "deepseek",
  "ollama",
  "openai-compatible",
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export const WEB_SUBSCRIPTION_PLANNERS = [
  "chatgpt-web",
  "claude-web",
  "gemini-web",
] as const;
export type WebSubscriptionPlanner = (typeof WEB_SUBSCRIPTION_PLANNERS)[number];

export const HARNESS_IDS = [
  "codex",
  "claude-code",
  "grok-build",
  "opencode",
  "kiro-cli",
] as const;
export type HarnessId = (typeof HARNESS_IDS)[number];

/** Default collaboration team. Any non-empty subset of `HARNESS_IDS` is valid. */
export const DEFAULT_HARNESS_TEAM: HarnessId[] = ["codex", "claude-code"];

export const HARNESS_PACKET_ROLES = ["implement", "test", "general"] as const;
export type HarnessPacketRole = (typeof HARNESS_PACKET_ROLES)[number];

export const HARNESS_RUN_STATES = ["pending", "executing", "executed"] as const;
export type HarnessRunState = (typeof HARNESS_RUN_STATES)[number];

export type SessionActor = "planner" | "system" | "user" | HarnessId;

export const PLANNER_CHOICES = ["auto", ...PROVIDER_IDS] as const;
export type PlannerChoice = (typeof PLANNER_CHOICES)[number];

export const ROLES = ["plan", "review", "execute"] as const;
export type Role = (typeof ROLES)[number];

export const PROTOCOL_STATES = [
  "INIT",
  "PLAN",
  "EXECUTING",
  "EXECUTED",
  "REVIEW",
  "DONE",
  "BLOCKED",
  "ERROR",
  "HANDOFF",
] as const;

export type ProtocolState = (typeof PROTOCOL_STATES)[number];

export const WORKSPACE_SOURCES = ["demo", "repo"] as const;
export type WorkspaceSource = (typeof WORKSPACE_SOURCES)[number];

export type WorkspaceFile = {
  path: string;
  content: string;
  language?: string;
};

export type PackedExcerpt = {
  path: string;
  startLine: number;
  endLine: number;
  content: string;
  reason: string;
  tokens: number;
};

export type ContextPack = {
  goal: string;
  tree: string;
  excerpts: PackedExcerpt[];
  omittedFiles: string[];
  skippedSensitive: string[];
  fileCount: number;
  rawTokens: number;
  packedTokens: number;
  budgetTokens: number;
  compressionRatio: number;
};

export type WorkPacket = {
  id: string;
  owner: HarnessId;
  role: HarnessPacketRole;
  actions: string[];
  files: string[];
  tests: string[];
  successCriteria: string[];
};

export type ExecutionPlan = {
  taskId: string;
  iteration: number;
  goal: string;
  rationale: string;
  actions: string[];
  filesLikelyInvolved: string[];
  tests: string[];
  successCriteria: string[];
  risks: string[];
  packets: WorkPacket[];
};

export type ExecutionBrief = {
  taskId: string;
  iteration: number;
  owner: HarnessId;
  goal: string;
  actions: string[];
  files: string[];
  tests: string[];
  successCriteria: string[];
  doNot: string[];
  tokenEstimate: number;
};

export type HarnessRun = {
  owner: HarnessId;
  state: HarnessRunState;
  changedFiles: string[];
  tests: string;
};

export const EXECUTION_EXIT_STATUSES = ["ok", "fail", "unknown"] as const;
export type ExecutionExitStatus = (typeof EXECUTION_EXIT_STATUSES)[number];

export function isExecutionExitStatus(value: string): value is ExecutionExitStatus {
  return (EXECUTION_EXIT_STATUSES as readonly string[]).includes(value);
}

export type ExecutionRecord = {
  taskId: string;
  iteration: number;
  owner: HarnessId;
  changedFiles: string[];
  tests: string;
  exitStatus: ExecutionExitStatus;
  recordedAt: string;
  diffStat: string;
};

export type ReviewVerdict = {
  taskId: string;
  iteration: number;
  state: Extract<ProtocolState, "DONE" | "PLAN" | "BLOCKED">;
  summary: string;
  issues: string[];
  nextActions: string[];
};

export type ProtocolMessage = {
  state: ProtocolState;
  taskId: string;
  iteration: number;
  sections: Record<string, string>;
  raw: string;
};

export type TokenLedger = {
  naiveCodexInput: number;
  naiveCodexOutput: number;
  c2xCodexInput: number;
  c2xCodexOutput: number;
  plannerInput: number;
  plannerOutput: number;
  naiveCodexTotal: number;
  c2xCodexTotal: number;
  plannerTotal: number;
  savedCodexTokens: number;
  savedCodexPercent: number;
  naiveCostUsd: number;
  c2xCostUsd: number;
  savedUsd: number;
  naiveHarnessTurns: number;
  c2xHarnessTurns: number;
  webChatTurns: number;
  savedHarnessTurns: number;
};

export type SessionEvent = {
  at: string;
  state: ProtocolState;
  actor: SessionActor;
  note: string;
};

export type SessionRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  goal: string;
  planner: ProviderId;
  plannerChoice: PlannerChoice;
  harness: HarnessId;
  harnessTeam: HarnessId[];
  budgetTokens: number;
  workspaceSource: WorkspaceSource;
  state: ProtocolState;
  pack: ContextPack | null;
  plan: ExecutionPlan | null;
  brief: ExecutionBrief | null;
  briefs: ExecutionBrief[];
  harnessRuns: HarnessRun[];
  records: ExecutionRecord[];
  review: ReviewVerdict | null;
  pastePrompt: string | null;
  reviewPastePrompt: string | null;
  usedFallback: boolean;
  fallbackReason: string | null;
  events: SessionEvent[];
  savings: TokenLedger | null;
};

export type ProviderStatus = {
  id: ProviderId;
  enabled: boolean;
  configured: boolean;
  label: string;
};

export type AppConfig = {
  enabledProviders: ProviderId[];
  defaultPlanner: PlannerChoice;
  defaultHarness: HarnessId;
  defaultHarnessTeam: HarnessId[];
  defaultBudget: number;
  keys: Partial<Record<ProviderId, string>>;
  openaiCompatibleBaseUrl: string;
  openaiCompatibleModel: string;
  ollamaModel: string;
  openaiModel: string;
  anthropicModel: string;
  geminiModel: string;
  groqModel: string;
  openrouterModel: string;
  deepseekModel: string;
};

export type ProviderCatalogEntry = {
  id: ProviderId;
  name: string;
  nameVi: string;
  kind: "local" | "subscription" | "api";
  blurb: string;
  blurbVi: string;
  defaultModel: string;
  usdPerMillionIn: number;
  usdPerMillionOut: number;
  envVar: string | null;
  needsKey: boolean;
  quotaVi: string;
  quotaEn: string;
};

export function assertNever(value: never, message: string): never {
  throw new Error(message);
}

export function isProviderId(value: string): value is ProviderId {
  return (PROVIDER_IDS as readonly string[]).includes(value);
}

export function isPlannerChoice(value: string): value is PlannerChoice {
  return (PLANNER_CHOICES as readonly string[]).includes(value);
}

export function isHarnessId(value: string): value is HarnessId {
  return (HARNESS_IDS as readonly string[]).includes(value);
}

export function isHarnessPacketRole(value: string): value is HarnessPacketRole {
  return (HARNESS_PACKET_ROLES as readonly string[]).includes(value);
}

export function isHarnessRunState(value: string): value is HarnessRunState {
  return (HARNESS_RUN_STATES as readonly string[]).includes(value);
}

export function normalizeHarnessTeam(value: unknown): HarnessId[] {
  const list = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,\s]+/)
      : [];
  const seen = new Set<HarnessId>();
  for (const item of list) {
    const id = String(item).trim();
    if (isHarnessId(id)) {
      seen.add(id);
    }
  }
  const ordered = HARNESS_IDS.filter((id) => seen.has(id));
  return ordered.length > 0 ? [...ordered] : [...DEFAULT_HARNESS_TEAM];
}

export function resolveHarnessTeam(input: {
  harnessTeam?: unknown;
  harness?: unknown;
  fallbackTeam?: readonly HarnessId[];
}): HarnessId[] {
  if (Array.isArray(input.harnessTeam) && input.harnessTeam.length > 0) {
    return normalizeHarnessTeam(input.harnessTeam);
  }
  if (typeof input.harnessTeam === "string" && input.harnessTeam.trim().length > 0) {
    return normalizeHarnessTeam(input.harnessTeam);
  }
  if (typeof input.harness === "string" && isHarnessId(input.harness)) {
    return [input.harness];
  }
  if (input.fallbackTeam && input.fallbackTeam.length > 0) {
    return normalizeHarnessTeam(input.fallbackTeam);
  }
  return [...DEFAULT_HARNESS_TEAM];
}

export function toggleHarnessInTeam(
  team: readonly HarnessId[],
  id: HarnessId,
): HarnessId[] {
  const seen = new Set(normalizeHarnessTeam(team));
  if (seen.has(id)) {
    if (seen.size <= 1) {
      return HARNESS_IDS.filter((item) => seen.has(item));
    }
    seen.delete(id);
  } else {
    seen.add(id);
  }
  return HARNESS_IDS.filter((item) => seen.has(item));
}

export function isWebSubscriptionPlannerId(
  value: string,
): value is WebSubscriptionPlanner {
  return (WEB_SUBSCRIPTION_PLANNERS as readonly string[]).includes(value);
}

export function isProtocolState(value: string): value is ProtocolState {
  return (PROTOCOL_STATES as readonly string[]).includes(value);
}

export function isWorkspaceSource(value: string): value is WorkspaceSource {
  return (WORKSPACE_SOURCES as readonly string[]).includes(value);
}
