export const PROVIDER_IDS = [
  "mock",
  "chatgpt-web",
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
};

export type ExecutionBrief = {
  taskId: string;
  iteration: number;
  goal: string;
  actions: string[];
  files: string[];
  tests: string[];
  successCriteria: string[];
  doNot: string[];
  tokenEstimate: number;
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
};

export type SessionEvent = {
  at: string;
  state: ProtocolState;
  actor: "planner" | "codex" | "system" | "user";
  note: string;
};

export type SessionRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  goal: string;
  planner: ProviderId;
  plannerChoice: PlannerChoice;
  budgetTokens: number;
  workspaceSource: WorkspaceSource;
  state: ProtocolState;
  pack: ContextPack | null;
  plan: ExecutionPlan | null;
  brief: ExecutionBrief | null;
  review: ReviewVerdict | null;
  pastePrompt: string | null;
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

export function isProtocolState(value: string): value is ProtocolState {
  return (PROTOCOL_STATES as readonly string[]).includes(value);
}

export function isWorkspaceSource(value: string): value is WorkspaceSource {
  return (WORKSPACE_SOURCES as readonly string[]).includes(value);
}
