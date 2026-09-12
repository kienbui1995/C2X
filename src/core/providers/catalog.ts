import {
  assertNever,
  type ProviderCatalogEntry,
  type ProviderId,
} from "@/core/types";

export const CODEX_USD_PER_MILLION_IN = 5;
export const CODEX_USD_PER_MILLION_OUT = 15;

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
  },
  {
    id: "chatgpt-web",
    name: "ChatGPT web",
    nameVi: "ChatGPT web",
    kind: "subscription",
    blurb: "Uses the Plus/Pro page you already pay for. Paste a compact prompt, paste the [C2X] plan back. $0 API.",
    blurbVi: "Dùng hạn mức ChatGPT Plus/Pro. Dán prompt ngắn, dán lại kế hoạch [C2X]. Không tốn API.",
    defaultModel: "chatgpt-web",
    usdPerMillionIn: 0,
    usdPerMillionOut: 0,
    envVar: null,
    needsKey: false,
  },
  {
    id: "groq",
    name: "Groq",
    nameVi: "Groq",
    kind: "api",
    blurb: "Very cheap, fast OpenAI-compatible chat. Good default paid planner.",
    blurbVi: "Rẻ và nhanh, tương thích OpenAI. Planner trả phí mặc định tốt.",
    defaultModel: "llama-3.3-70b-versatile",
    usdPerMillionIn: 0.59,
    usdPerMillionOut: 0.79,
    envVar: "GROQ_API_KEY",
    needsKey: true,
  },
  {
    id: "gemini",
    name: "Gemini",
    nameVi: "Gemini",
    kind: "api",
    blurb: "Google Gemini Flash for inexpensive planning and review.",
    blurbVi: "Gemini Flash của Google: lập kế hoạch và review giá thấp.",
    defaultModel: "gemini-2.0-flash",
    usdPerMillionIn: 0.1,
    usdPerMillionOut: 0.4,
    envVar: "GEMINI_API_KEY",
    needsKey: true,
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
  },
  {
    id: "openai",
    name: "OpenAI",
    nameVi: "OpenAI",
    kind: "api",
    blurb: "Official API. Prefer a mini/nano model so planning stays cheaper than Codex.",
    blurbVi: "API chính thức. Nên dùng model mini/nano để phần nghĩ rẻ hơn Codex.",
    defaultModel: "gpt-4.1-mini",
    usdPerMillionIn: 0.4,
    usdPerMillionOut: 1.6,
    envVar: "OPENAI_API_KEY",
    needsKey: true,
  },
  {
    id: "anthropic",
    name: "Anthropic",
    nameVi: "Anthropic",
    kind: "api",
    blurb: "Claude for planning/review. Use Haiku unless the task is unusually hard.",
    blurbVi: "Claude cho kế hoạch/review. Dùng Haiku trừ khi bài quá khó.",
    defaultModel: "claude-3-5-haiku-latest",
    usdPerMillionIn: 0.8,
    usdPerMillionOut: 4,
    envVar: "ANTHROPIC_API_KEY",
    needsKey: true,
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
  },
];

export function getProvider(id: ProviderId): ProviderCatalogEntry {
  switch (id) {
    case "mock":
    case "chatgpt-web":
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

export function providerKindLabel(id: ProviderId): string {
  return getProvider(id).kind;
}
