const SENSITIVE_NAME =
  /(^|\/)(\.env($|\..+)|.*\.(pem|key|p12|pfx)|id_rsa|id_ed25519|credentials|secret|auth\.json|service-account.*\.json)$/i;

const SENSITIVE_DIR = /(^|\/)(\.ssh|secrets|private)(\/|$)/i;

export const DEFAULT_IGNORE = [
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".vercel",
  "agent-tools",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  ".DS_Store",
];

export function isSensitivePath(filePath: string): boolean {
  const normalized = filePath.replaceAll("\\", "/");
  if (normalized.endsWith(".env.example") || normalized.endsWith(".env.sample")) {
    return false;
  }
  return SENSITIVE_NAME.test(normalized) || SENSITIVE_DIR.test(normalized);
}

export function isIgnoredPath(filePath: string, extra: string[] = []): boolean {
  const normalized = filePath.replaceAll("\\", "/");
  const rules = [...DEFAULT_IGNORE, ...extra];
  return rules.some((rule) => {
    if (normalized === rule || normalized.endsWith(`/${rule}`)) {
      return true;
    }
    return normalized.includes(`/${rule}/`) || normalized.startsWith(`${rule}/`);
  });
}
