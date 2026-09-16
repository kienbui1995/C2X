const SENSITIVE_NAME =
  /(^|\/)(\.env($|\..+)|\.envrc|\.npmrc|\.netrc|\.git-credentials|.*\.(pem|key|p12|pfx)|id_rsa|id_ed25519|id_ecdsa|credentials|secret|auth\.json|service-account.*\.json)$/i;

const SENSITIVE_DIR = /(^|\/)(\.ssh|secrets|private)(\/|$)/i;

export const DEFAULT_IGNORE = [
  "node_modules",
  ".git",
  ".next",
  ".c2x",
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

export function isSafeImportedPath(filePath: string): boolean {
  const trimmed = filePath.trim();
  if (!trimmed || trimmed === "(none)") {
    return false;
  }
  const normalized = trimmed.replaceAll("\\", "/");
  if (pathPosixAbsolute(normalized) || pathWin32Absolute(trimmed)) {
    return false;
  }
  if (normalized.split("/").includes("..")) {
    return false;
  }
  return !isSensitivePath(normalized);
}

function pathPosixAbsolute(filePath: string): boolean {
  return filePath.startsWith("/");
}

function pathWin32Absolute(filePath: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(filePath) || filePath.startsWith("\\\\");
}

export function sanitizeImportedFiles(files: string[]): string[] {
  return files.filter((item) => isSafeImportedPath(item));
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
