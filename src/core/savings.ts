import {
  getProvider,
  isWebSubscriptionPlanner,
  CODEX_USD_PER_MILLION_IN,
  CODEX_USD_PER_MILLION_OUT,
} from "@/core/providers/catalog";
import { costUsd, estimateTokens } from "@/core/tokens";
import type { ContextPack, ExecutionBrief, ProviderId, TokenLedger } from "@/core/types";

export function estimateSavings(input: {
  pack: ContextPack;
  brief: ExecutionBrief | null;
  planner: ProviderId;
  plannerOutputTokens?: number;
}): TokenLedger {
  const plannerMeta = getProvider(input.planner);
  const briefTokens = input.brief?.tokenEstimate ?? estimateTokens(input.pack.goal) + 180;
  const plannerOutput = input.plannerOutputTokens ?? 700;
  const reviewPack = Math.min(900, Math.round(input.pack.packedTokens * 0.25) + 200);

  const naiveCodexInput =
    input.pack.rawTokens +
    estimateTokens(input.pack.goal) * 3 +
    1800 +
    Math.round(input.pack.rawTokens * 0.2);
  const naiveCodexOutput = 2500 + 4000 + 1200;
  const c2xCodexInput = briefTokens + 220;
  const c2xCodexOutput = 3600;
  const plannerInput = input.pack.packedTokens + reviewPack;
  const plannerOut = plannerOutput + 400;

  const naiveCodexTotal = naiveCodexInput + naiveCodexOutput;
  const c2xCodexTotal = c2xCodexInput + c2xCodexOutput;
  const plannerTotal = plannerInput + plannerOut;
  const savedCodexTokens = Math.max(0, naiveCodexTotal - c2xCodexTotal);
  const savedCodexPercent = naiveCodexTotal === 0 ? 0 : savedCodexTokens / naiveCodexTotal;

  const naiveCostUsd =
    costUsd(naiveCodexInput, CODEX_USD_PER_MILLION_IN) +
    costUsd(naiveCodexOutput, CODEX_USD_PER_MILLION_OUT);
  const c2xCostUsd =
    costUsd(c2xCodexInput, CODEX_USD_PER_MILLION_IN) +
    costUsd(c2xCodexOutput, CODEX_USD_PER_MILLION_OUT) +
    costUsd(plannerInput, plannerMeta.usdPerMillionIn) +
    costUsd(plannerOut, plannerMeta.usdPerMillionOut);

  const naiveHarnessTurns = 3;
  const c2xHarnessTurns = 1;
  const webChatTurns = isWebSubscriptionPlanner(input.planner) ? 2 : 0;
  const savedHarnessTurns = Math.max(0, naiveHarnessTurns - c2xHarnessTurns);

  return {
    naiveCodexInput,
    naiveCodexOutput,
    c2xCodexInput,
    c2xCodexOutput,
    plannerInput,
    plannerOutput: plannerOut,
    naiveCodexTotal,
    c2xCodexTotal,
    plannerTotal,
    savedCodexTokens,
    savedCodexPercent,
    naiveCostUsd,
    c2xCostUsd,
    savedUsd: Math.max(0, naiveCostUsd - c2xCostUsd),
    naiveHarnessTurns,
    c2xHarnessTurns,
    webChatTurns,
    savedHarnessTurns,
  };
}

export function emptyLedger(): TokenLedger {
  return {
    naiveCodexInput: 0,
    naiveCodexOutput: 0,
    c2xCodexInput: 0,
    c2xCodexOutput: 0,
    plannerInput: 0,
    plannerOutput: 0,
    naiveCodexTotal: 0,
    c2xCodexTotal: 0,
    plannerTotal: 0,
    savedCodexTokens: 0,
    savedCodexPercent: 0,
    naiveCostUsd: 0,
    c2xCostUsd: 0,
    savedUsd: 0,
    naiveHarnessTurns: 0,
    c2xHarnessTurns: 0,
    webChatTurns: 0,
    savedHarnessTurns: 0,
  };
}

export function sumLedgers(ledgers: TokenLedger[]): TokenLedger {
  return ledgers.reduce((acc, item) => ({
    naiveCodexInput: acc.naiveCodexInput + item.naiveCodexInput,
    naiveCodexOutput: acc.naiveCodexOutput + item.naiveCodexOutput,
    c2xCodexInput: acc.c2xCodexInput + item.c2xCodexInput,
    c2xCodexOutput: acc.c2xCodexOutput + item.c2xCodexOutput,
    plannerInput: acc.plannerInput + item.plannerInput,
    plannerOutput: acc.plannerOutput + item.plannerOutput,
    naiveCodexTotal: acc.naiveCodexTotal + item.naiveCodexTotal,
    c2xCodexTotal: acc.c2xCodexTotal + item.c2xCodexTotal,
    plannerTotal: acc.plannerTotal + item.plannerTotal,
    savedCodexTokens: acc.savedCodexTokens + item.savedCodexTokens,
    savedCodexPercent: 0,
    naiveCostUsd: acc.naiveCostUsd + item.naiveCostUsd,
    c2xCostUsd: acc.c2xCostUsd + item.c2xCostUsd,
    savedUsd: acc.savedUsd + item.savedUsd,
    naiveHarnessTurns: acc.naiveHarnessTurns + (item.naiveHarnessTurns ?? 0),
    c2xHarnessTurns: acc.c2xHarnessTurns + (item.c2xHarnessTurns ?? 0),
    webChatTurns: acc.webChatTurns + (item.webChatTurns ?? 0),
    savedHarnessTurns: acc.savedHarnessTurns + (item.savedHarnessTurns ?? 0),
  }), emptyLedger());
}
