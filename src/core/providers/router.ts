import {
  getHarness,
  getProvider,
  isWebSubscriptionPlanner,
  plannerKindRank,
} from "@/core/providers/catalog";
import {
  assertNever,
  isHarnessId,
  type AppConfig,
  type HarnessId,
  type PlannerChoice,
  type ProviderId,
  type Role,
} from "@/core/types";

export type RouteDecision = {
  role: Role;
  provider: ProviderId | HarnessId;
  reason: string;
  reasonVi: string;
};

function readyPlanners(config: AppConfig, hasKey: (id: ProviderId) => boolean): ProviderId[] {
  return config.enabledProviders.filter((id) => {
    const entry = getProvider(id);
    if (!entry.needsKey) {
      return true;
    }
    return hasKey(id);
  });
}

function cheapestReady(config: AppConfig, hasKey: (id: ProviderId) => boolean): ProviderId {
  const ready = readyPlanners(config, hasKey);
  if (ready.length === 0) {
    return "mock";
  }
  return [...ready].sort((a, b) => {
    const byKind = plannerKindRank(a) - plannerKindRank(b);
    if (byKind !== 0) {
      return byKind;
    }
    const left = getProvider(a);
    const right = getProvider(b);
    const byCost = left.usdPerMillionIn - right.usdPerMillionIn;
    if (byCost !== 0) {
      return byCost;
    }
    return left.name.localeCompare(right.name);
  })[0];
}

function executeDecision(harness: HarnessId): RouteDecision {
  const entry = getHarness(harness);
  switch (harness) {
    case "codex":
    case "claude-code":
    case "grok-build":
    case "opencode":
      return {
        role: "execute",
        provider: harness,
        reason: `${entry.name} is the execution harness only: edit, shell, test, git. Never plan or review here.`,
        reasonVi: `${entry.nameVi} chỉ là harness chạy: sửa file, shell, test, git. Không lập kế hoạch hay review ở đây.`,
      };
    default:
      return assertNever(harness, `Unknown harness: ${harness}`);
  }
}

export function routeExecuteTeam(team: readonly HarnessId[]): RouteDecision[] {
  const resolved = team.filter(isHarnessId);
  return resolved.map((harness) => executeDecision(harness));
}

export function routeRole(input: {
  role: Role;
  choice: PlannerChoice;
  harness?: HarnessId;
  harnessTeam?: readonly HarnessId[];
  config: AppConfig;
  hasKey: (id: ProviderId) => boolean;
}): RouteDecision {
  switch (input.role) {
    case "execute":
      return executeDecision(
        input.harness ?? input.harnessTeam?.[0] ?? input.config.defaultHarness,
      );
    case "plan":
    case "review": {
      if (input.choice !== "auto") {
        return {
          role: input.role,
          provider: input.choice,
          reason: `You pinned ${input.choice} for ${input.role}. Execution harnesses never take this role.`,
          reasonVi: `Bạn đã ghim ${input.choice} cho bước ${input.role}. Harness chạy không bao giờ nhận vai này.`,
        };
      }
      const provider = cheapestReady(input.config, input.hasKey);
      const webFirst = isWebSubscriptionPlanner(provider);
      return {
        role: input.role,
        provider,
        reason: webFirst
          ? `Auto preferred a large web/subscription chat quota: ${provider}.`
          : `Auto picked the cheapest ready planner: ${provider}.`,
        reasonVi: webFirst
          ? `Tự ưu tiên hạn mức chat web/subscription lớn: ${provider}.`
          : `Tự chọn planner sẵn sàng rẻ nhất: ${provider}.`,
      };
    }
    default:
      return assertNever(input.role, `Unknown role: ${input.role}`);
  }
}

export function resolvePlanner(input: {
  choice: PlannerChoice;
  config: AppConfig;
  hasKey: (id: ProviderId) => boolean;
}): ProviderId {
  const decision = routeRole({
    role: "plan",
    choice: input.choice,
    config: input.config,
    hasKey: input.hasKey,
  });
  if (isHarnessId(decision.provider)) {
    return "mock";
  }
  return decision.provider;
}
