import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function isChatToXRoot(dir: string): boolean {
  const pkgPath = path.join(dir, "package.json");
  if (!existsSync(pkgPath) || !existsSync(path.join(dir, "skill", "SKILL.md"))) {
    return false;
  }
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { name?: string };
    return pkg.name === "chat-to-x";
  } catch {
    return false;
  }
}

export function packageRoot(startDir?: string): string {
  let dir = startDir ?? path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i += 1) {
    if (isChatToXRoot(dir)) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  throw new Error("chat-to-x package root not found. Install chat-to-x, then run c2x init.");
}
