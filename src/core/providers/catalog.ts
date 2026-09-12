import {
  assertNever,
  type AppConfig,
  type HarnessId,
  type ProviderCatalogEntry,
  type ProviderId,
  type WebSubscriptionPlanner,
} from "@/core/types";

export const CODEX_USD_PER_MILLION_IN = 5;
export const CODEX_USD_PER_MILLION_OUT = 15;

export type HarnessCatalogEntry = {
  id: HarnessId;
  name: string;
  nameVi: string;
  blurb: string;
  blurbVi: string;
  quotaVi: string;
  quotaEn: string;
};

export const PROVIDER_CATALOG: readonly ProviderCatalogEntry[] = [
  {
    id: "mock",
    name: "Mock planner",
    nameVi: "Planner giả lập",
    kind: "local",
    blurb: "No key. Deterministic plans from the packed workspace so the loop works offline.",
    blurbVi: "Không cần key. Sinh kế hoạch từ context đã nén để chạy vòng lặp khi chưa gắn API.",
    defaultModel: "frugal-mock",
    usdPerMillionIn: 0,
    usdPerMillionOut: 0,
    envVar: null,
    needsKey: false,
    quotaVi: "Local / không đốt hạn mức chat web",
    quotaEn: "Local / does not spend web-chat quota",
  },
  {
    id: "chatgpt-web",
    name: "ChatGPT web",
    nameVi: "ChatGPT web",
    kind: "subscription",
    blurb: "Large included ChatGPT chat allowance. Paste a compact prompt, paste the [C2X] plan back. $0 API. Never a reverse proxy.",
    blurbVi: "Quota chat lớn trên ChatGPT (Plus/Pro hoặc tầng miễn phí). Dán prompt ngắn, dán lại kế hoạch [C2X]. Không tốn API, không lấy cookie.",
    defaultModel: "chatgpt-web",
    usdPerMillionIn: 0,
    usdPerMillionOut: 0,
    envVar: null,
    needsKey: false,
    quotaVi: "Quota chat lớn / subscription",
    quotaEn: "Large chat quota / subscription",
  },
  {
    id: "claude-web",
    name: "Claude web",
    nameVi: "Claude web",
    kind: "subscription",
    blurb: "claude.ai included chats. Same paste loop as ChatGPT web: compact prompt out, [C2X] PLAN back. Not Claude Code.",
    blurbVi: "Lượt chat sẵn có trên claude.ai. Cùng vòng dán như ChatGPT web: prompt nén đi, [C2X] PLAN về. Không phải Claude Code.",
    defaultModel: "claude-web",
    usdPerMillionIn: 0,
    usdPerMillionOut: 0,
    envVar: null,
    needsKey: false,
    quotaVi: "Quota chat lớn / subscription",
    quotaEn: "Large chat quota / subscription",
  },
  {
    id: "gemini-web",
    name: "Gemini web",
    nameVi: "Gemini web",
    kind: "subscription",
    blurb: "gemini.google.com included chats. Paste-mode planner. Separate from the Gemini API key.",
    blurbVi: "Lượt chat sẵn có trên gemini.google.com. Planner chế độ dán. Tách khỏi Gemini API.",
    defaultModel: "gemini-web",
    usdPerMillionIn: 0,
    usdPerMillionOut: 0,
    envVar: null,
    needsKey: false,
    quotaVi: "Quota chat lớn / subscription",
    quotaEn: "Large chat quota / subscription",
  },
  {
    id: "groq",
    name: "Groq",
    nameVi: "Groq",
    kind: "api",
    blurb: "Very cheap, fast OpenAI-compatible chat. Use only after web-chat quotas are off or you want an API.",
    blurbVi: "Rẻ và nhanh, tương thích OpenAI. Chỉ dùng khi không bật planner chat web, hoặc bạn muốn API.",
    defaultModel: "llama-3.3-70b-versatile",
    usdPerMillionIn: 0.59,
    usdPerMillionOut: 0.79,
    envVar: "GROQ_API_KEY",
    needsKey: true,
    quotaVi: "API trả phí (token)",
    quotaEn: "Paid API tokens",
  },
  {
    id: "gemini",
    name: "Gemini API",
    nameVi: "Gemini API",
    kind: "api",
    blurb: "Google Gemini Flash API. Prefer Gemini web when you already have included chats.",
    blurbVi: "API Gemini Flash. Ưu tiên Gemini web nếu bạn đã có lượt chat kèm theo.",
    defaultModel: "gemini-2.0-flash",
    usdPerMillionIn: 0.1,
    usdPerMillionOut: 0.4,
    envVar: "GEMINI_API_KEY",
    needsKey: true,
    quotaVi: "API trả phí (token)",
    quotaEn: "Paid API tokens",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    nameVi: "DeepSeek",
    kind: "api",
    blurb: "Strong reasoning per dollar. OpenAI-compatible endpoint.",
    blurbVi: "Suy luận tốt theo từng đô. Endpoint tương thích OpenAI.",
    defaultModel: "deepseek-chat",
    usdPerMillionIn: 0.28,
    usdPerMillionOut: 0.42,
    envVar: "DEEPSEEK_API_KEY",
    needsKey: true,
    quotaVi: "API trả phí (token)",
    quotaEn: "Paid API tokens",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    nameVi: "OpenRouter",
    kind: "api",
    blurb: "One key, many models. Route planning to whatever is cheapest this week.",
    blurbVi: "Một key, nhiều model. Đổi planner sang model rẻ nhất trong tuần.",
    defaultModel: "openrouter/auto",
    usdPerMillionIn: 0.15,
    usdPerMillionOut: 0.6,
    envVar: "OPENROUTER_API_KEY",
    needsKey: true,
    quotaVi: "API trả phí (token)",
    quotaEn: "Paid API tokens",
  },
  {
    id: "ollama",
    name: "Ollama",
    nameVi: "Ollama",
    kind: "local",
    blurb: "Local models. Zero API spend after you pull a model.",
    blurbVi: "Chạy local. Không tốn API sau khi kéo model.",
    defaultModel: "qwen2.5-coder:7b",
    usdPerMillionIn: 0,
    usdPerMillionOut: 0,
    envVar: "OLLAMA_BASE_URL",
    needsKey: false,
    quotaVi: "Local / không đốt hạn mức chat web",
    quotaEn: "Local / does not spend web-chat quota",
  },
  {
    id: "openai",
    name: "OpenAI",
    nameVi: "OpenAI",
    kind: "api",
    blurb: "Official API. Prefer ChatGPT web so you spend included chats, not API tokens.",
    blurbVi: "API chính thức. Ưu tiên ChatGPT web để xài lượt chat kèm theo, không đốt token API.",
    defaultModel: "gpt-4.1-mini",
    usdPerMillionIn: 0.4,
    usdPerMillionOut: 1.6,
    envVar: "OPENAI_API_KEY",
    needsKey: true,
    quotaVi: "API trả phí (token)",
    quotaEn: "Paid API tokens",
  },
  {
    id: "anthropic",
    name: "Anthropic API",
    nameVi: "Anthropic API",
    kind: "api",
    blurb: "Claude API (Haiku/Sonnet). Prefer Claude web for plan/review; keep Claude Code for execution.",
    blurbVi: "API Claude (Haiku/Sonnet). Ưu tiên Claude web cho kế hoạch/review; giữ Claude Code để chạy.",
    defaultModel: "claude-3-5-haiku-latest",
    usdPerMillionIn: 0.8,
    usdPerMillionOut: 4,
    envVar: "ANTHROPIC_API_KEY",
    needsKey: true,
    quotaVi: "API trả phí (token)",
    quotaEn: "Paid API tokens",
  },
  {
    id: "openai-compatible",
    name: "Custom OpenAI-compatible",
    nameVi: "Tùy chỉnh tương thích OpenAI",
    kind: "api",
    blurb: "Any /v1/chat/completions host: Together, Fireworks, vLLM, Azure-compatible, etc.",
    blurbVi: "Mọi host /v1/chat/completions: Together, Fireworks, vLLM, Azure-compatible...",
    defaultModel: "custom-model",
    usdPerMillionIn: 0.2,
    usdPerMillionOut: 0.6,
    envVar: "CUSTOM_OPENAI_API_KEY",
    needsKey: true,
    quotaVi: "API trả phí (token)",
    quotaEn: "Paid API tokens",
  },
];

export const HARNESS_CATALOG: readonly HarnessCatalogEntry[] = [
  {
    id: "codex",
    name: "Codex",
    nameVi: "Codex",
    blurb: "Scarce execution-harness quota. Pair it with other harnesses on one plan; execute only your packet.",
    blurbVi: "Hạn mức harness khan hiếm. Ghép với harness khác trên cùng một kế hoạch; chỉ chạy packet của mình.",
    quotaVi: "Hạn mức harness khan hiếm",
    quotaEn: "Scarce harness quota",
  },
  {
    id: "claude-code",
    name: "Claude Code",
    nameVi: "Claude Code",
    blurb: "Same execute-only role as Codex. Combine both quotas on one plan instead of burning one tool for everything.",
    blurbVi: "Cùng vai trò chỉ chạy như Codex. Gộp hạn mức với Codex trên một kế hoạch, đừng bắt một tool làm hết.",
    quotaVi: "Hạn mức harness khan hiếm",
    quotaEn: "Scarce harness quota",
  },
  {
    id: "grok-build",
    name: "Grok Build",
    nameVi: "Grok Build",
    blurb: "xAI Grok coding harness. Execution only — edit, shell, test, git. Never plan or review.",
    blurbVi: "Harness coding xAI Grok. Chỉ chạy: sửa file, shell, test, git. Không lập kế hoạch hay review.",
    quotaVi: "Hạn mức harness khan hiếm",
    quotaEn: "Scarce harness quota",
  },
  {
    id: "opencode",
    name: "OpenCode",
    nameVi: "OpenCode",
    blurb: "Open-source coding-agent harness. Execution only — edit, shell, test, git. Never plan or review.",
    blurbVi: "Harness agent coding mã nguồn mở. Chỉ chạy: sửa file, shell, test, git. Không lập kế hoạch hay review.",
    quotaVi: "Hạn mức harness khan hiếm",
    quotaEn: "Scarce harness quota",
  },
  {
    id: "kiro-cli",
    name: "Kiro CLI",
    nameVi: "Kiro CLI",
    blurb: "Kiro CLI — execution harness. AWS Kiro coding CLI. Same execute-only role as Codex: edit, shell, test, git. Never plan or review.",
    blurbVi: "Kiro CLI — harness thực thi. CLI coding AWS Kiro. Cùng vai trò chỉ chạy như Codex: sửa file, shell, test, git. Không lập kế hoạch hay review.",
    quotaVi: "Hạn mức harness khan hiếm",
    quotaEn: "Scarce harness quota",
  },
];

export function getProvider(id: ProviderId): ProviderCatalogEntry {
  switch (id) {
    case "mock":
    case "chatgpt-web":
    case "claude-web":
    case "gemini-web":
    case "openai":
    case "anthropic":
    case "gemini":
    case "groq":
    case "openrouter":
    case "deepseek":
    case "ollama":
    case "openai-compatible": {
      const found = PROVIDER_CATALOG.find((entry) => entry.id === id);
      if (!found) {
        throw new Error(`Missing catalog entry: ${id}`);
      }
      return found;
    }
    default:
      return assertNever(id, `Unknown provider: ${id}`);
  }
}

export function getHarness(id: HarnessId): HarnessCatalogEntry {
  switch (id) {
    case "codex":
    case "claude-code":
    case "grok-build":
    case "opencode":
    case "kiro-cli": {
      const found = HARNESS_CATALOG.find((entry) => entry.id === id);
      if (!found) {
        throw new Error(`Missing harness catalog entry: ${id}`);
      }
      return found;
    }
    default:
      return assertNever(id, `Unknown harness: ${id}`);
  }
}

export function providerKindLabel(id: ProviderId): string {
  return getProvider(id).kind;
}

export function isWebSubscriptionPlanner(id: ProviderId): id is WebSubscriptionPlanner {
  switch (id) {
    case "chatgpt-web":
    case "claude-web":
    case "gemini-web":
      return true;
    case "mock":
    case "openai":
    case "anthropic":
    case "gemini":
    case "groq":
    case "openrouter":
    case "deepseek":
    case "ollama":
    case "openai-compatible":
      return false;
    default:
      return assertNever(id, `Unknown provider: ${id}`);
  }
}

export function isPastePlanner(id: ProviderId): id is WebSubscriptionPlanner {
  return isWebSubscriptionPlanner(id);
}

export function modelForProvider(id: ProviderId, config: AppConfig): string {
  switch (id) {
    case "mock":
    case "chatgpt-web":
    case "claude-web":
    case "gemini-web":
      return getProvider(id).defaultModel;
    case "openai":
      return config.openaiModel;
    case "anthropic":
      return config.anthropicModel;
    case "gemini":
      return config.geminiModel;
    case "groq":
      return config.groqModel;
    case "openrouter":
      return config.openrouterModel;
    case "deepseek":
      return config.deepseekModel;
    case "ollama":
      return config.ollamaModel;
    case "openai-compatible":
      return config.openaiCompatibleModel;
    default:
      return assertNever(id, `Unknown provider: ${id}`);
  }
}

export function plannerKindRank(id: ProviderId): number {
  const kind = getProvider(id).kind;
  switch (kind) {
    case "subscription":
      return 0;
    case "local":
      return 1;
    case "api":
      return 2;
    default:
      return assertNever(kind, `Unknown provider kind: ${kind}`);
  }
}
