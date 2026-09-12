import { getProvider } from "@/core/providers/catalog";
import {
  assertNever,
  type AppConfig,
  type PlannerChoice,
  type ProviderId,
  type Role,
} from "@/core/types";

export type RouteDecision = {
  role: Role;
  provider: ProviderId | "codex";
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
    const left = getProvider(a);
    const right = getProvider(b);
    const byCost = left.usdPerMillionIn - right.usdPerMillionIn;
    if (byCost !== 0) {
      return byCost;
    }
    return left.name.localeCompare(right.name);
  })[0];
}

export function routeRole(input: {
  role: Role;
  choice: PlannerChoice;
  config: AppConfig;
  hasKey: (id: ProviderId) => boolean;
}): RouteDecision {
  switch (input.role) {
    case "execute":
      return {
        role: "execute",
        provider: "codex",
        reason: "Codex keeps the harness: edit, shell, test, git.",
        reasonVi: "Codex giữ harness: sửa file, shell, test, git.",
      };
    case "plan":
    case "review": {
      if (input.choice !== "auto") {
        return {
          role: input.role,
          provider: input.choice,
          reason: `You pinned ${input.choice} for ${input.role}.`,
          reasonVi: `Bạn đã ghim ${input.choice} cho bước ${input.role}.`,
        };
      }
      const provider = cheapestReady(input.config, input.hasKey);
      return {
        role: input.role,
        provider,
        reason: `Auto picked the cheapest ready planner: ${provider}.`,
        reasonVi: `Tự chọn planner sẵn sàng rẻ nhất: ${provider}.`,
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
  if (decision.provider === "codex") {
    return "mock";
  }
  return decision.provider;
}
