const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  if (!text) {
    return 0;
  }
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return Math.ceil(text.length / CHARS_PER_TOKEN);
  }
  const wordish = normalized.split(" ").length;
  const byChars = Math.ceil(text.length / CHARS_PER_TOKEN);
  return Math.max(1, Math.round(byChars * 0.65 + wordish * 0.35));
}

export function formatTokens(tokens: number): string {
  if (tokens < 1000) {
    return `${tokens}`;
  }
  if (tokens < 10_000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return `${Math.round(tokens / 1000)}k`;
}

export function formatUsd(amount: number): string {
  if (amount <= 0) {
    return "$0.00";
  }
  if (amount < 0.01) {
    return `$${amount.toFixed(4)}`;
  }
  return `$${amount.toFixed(2)}`;
}

export function costUsd(
  tokens: number,
  usdPerMillion: number,
): number {
  return (tokens / 1_000_000) * usdPerMillion;
}

export function clampBudget(budget: number): number {
  if (!Number.isFinite(budget)) {
    return 4000;
  }
  return Math.min(16_000, Math.max(800, Math.round(budget)));
}
