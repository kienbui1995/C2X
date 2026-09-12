import { resolvedKey } from "@/core/config";
import { isPastePlanner, modelForProvider } from "@/core/providers/catalog";
import { assertNever, type AppConfig, type ProviderId } from "@/core/types";

export type CompletionResult = {
  text: string;
  usedFallback: boolean;
  fallbackReason: string | null;
  provider: ProviderId;
  model: string;
};

type ChatMessage = { role: "system" | "user"; content: string };

function modelFor(id: ProviderId, config: AppConfig): string {
  return modelForProvider(id, config);
}

function openaiCompatTarget(id: ProviderId, config: AppConfig): { url: string; headers: Record<string, string> } {
  const key = resolvedKey(config, id) ?? "";
  switch (id) {
    case "openai":
      return {
        url: "https://api.openai.com/v1/chat/completions",
        headers: { Authorization: `Bearer ${key}` },
      };
    case "groq":
      return {
        url: "https://api.groq.com/openai/v1/chat/completions",
        headers: { Authorization: `Bearer ${key}` },
      };
    case "openrouter":
      return {
        url: "https://openrouter.ai/api/v1/chat/completions",
        headers: {
          Authorization: `Bearer ${key}`,
          "HTTP-Referer": "https://frugal-codex.local",
          "X-Title": "Frugal Codex",
        },
      };
    case "deepseek":
      return {
        url: "https://api.deepseek.com/v1/chat/completions",
        headers: { Authorization: `Bearer ${key}` },
      };
    case "ollama":
      return {
        url: `${(process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "")}/v1/chat/completions`,
        headers: {},
      };
    case "openai-compatible":
      return {
        url: `${config.openaiCompatibleBaseUrl.replace(/\/$/, "")}/chat/completions`,
        headers: key ? { Authorization: `Bearer ${key}` } : {},
      };
    case "mock":
    case "chatgpt-web":
    case "claude-web":
    case "gemini-web":
    case "anthropic":
    case "gemini":
      throw new Error(`${id} is not OpenAI-compatible in this client.`);
    default:
      return assertNever(id, `Unknown provider: ${id}`);
  }
}

async function completeOpenAiCompat(
  id: ProviderId,
  config: AppConfig,
  messages: ChatMessage[],
): Promise<string> {
  const { url, headers } = openaiCompatTarget(id, config);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({
      model: modelFor(id, config),
      temperature: 0.2,
      messages,
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${id} HTTP ${response.status}: ${body.slice(0, 240)}`);
  }
  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error(`${id} returned an empty completion.`);
  }
  return text;
}

async function completeAnthropic(config: AppConfig, messages: ChatMessage[]): Promise<string> {
  const key = resolvedKey(config, "anthropic");
  if (!key) {
    throw new Error("Missing Anthropic API key.");
  }
  const system = messages.find((item) => item.role === "system")?.content ?? "";
  const user = messages.filter((item) => item.role === "user");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.anthropicModel,
      max_tokens: 1200,
      system,
      messages: user.map((item) => ({ role: "user", content: item.content })),
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`anthropic HTTP ${response.status}: ${body.slice(0, 240)}`);
  }
  const json = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = json.content?.find((item) => item.type === "text")?.text;
  if (!text) {
    throw new Error("Anthropic returned an empty completion.");
  }
  return text;
}

async function completeGemini(config: AppConfig, messages: ChatMessage[]): Promise<string> {
  const key = resolvedKey(config, "gemini") || process.env.GOOGLE_API_KEY;
  if (!key) {
    throw new Error("Missing Gemini API key.");
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent?key=${key}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: messages.map((item) => `${item.role}:\n${item.content}`).join("\n\n") }],
        },
      ],
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`gemini HTTP ${response.status}: ${body.slice(0, 240)}`);
  }
  const json = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini returned an empty completion.");
  }
  return text;
}

export async function completePlanner(input: {
  provider: ProviderId;
  config: AppConfig;
  messages: ChatMessage[];
  allowFallback?: boolean;
}): Promise<CompletionResult> {
  const { provider, config, messages } = input;
  const allowFallback = input.allowFallback ?? true;
  const model = modelFor(provider, config);

  if (provider === "mock" || isPastePlanner(provider)) {
    return {
      text: "",
      usedFallback: false,
      fallbackReason: null,
      provider,
      model,
    };
  }

  try {
    let text = "";
    switch (provider) {
      case "openai":
      case "groq":
      case "openrouter":
      case "deepseek":
      case "ollama":
      case "openai-compatible":
        text = await completeOpenAiCompat(provider, config, messages);
        break;
      case "anthropic":
        text = await completeAnthropic(config, messages);
        break;
      case "gemini":
        text = await completeGemini(config, messages);
        break;
      default:
        return assertNever(provider, `Unknown provider: ${provider}`);
    }
    return {
      text,
      usedFallback: false,
      fallbackReason: null,
      provider,
      model,
    };
  } catch (error) {
    if (!allowFallback) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "provider failed";
    return {
      text: "",
      usedFallback: true,
      fallbackReason: message,
      provider: "mock",
      model: "frugal-mock",
    };
  }
}
