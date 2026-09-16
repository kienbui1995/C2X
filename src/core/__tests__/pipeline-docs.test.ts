import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const files = [
  path.join(process.cwd(), "README.md"),
  path.join(process.cwd(), "skill/SKILL.md"),
  path.join(process.cwd(), "docs/architecture.md"),
];

describe("full-pipeline docs", () => {
  it("publishes one unofficial role table and keeps Codex off review", () => {
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text).toMatch(/Brainstorm|nghiệp vụ/);
      expect(text).toMatch(/ChatGPT/);
      expect(text).toMatch(/OpenDesign/);
      expect(text).toMatch(/DESIGN\.md/);
      expect(text).toMatch(/Claude Code/);
      expect(text).toMatch(/Codex/);
      expect(text).toMatch(/Grok Build/);
      expect(text).toMatch(/docs\/wiki/);
      expect(text).toMatch(/Codex (does not|không) review|không review|does not review/i);
      expect(text).toMatch(/unofficial|không chính thức|Không liên kết/i);
      expect(text).toMatch(/[Nn]o Jira OAuth|Không Jira OAuth|không dùng OAuth/i);
      expect(text).not.toMatch(/Jira Cloud OAuth app|Azure DevOps PAT in repo/i);
      expect(text).toMatch(/Never `npx c2x`|Không[\s\S]*npx c2x|never recommend the npm package named `c2x`/i);
    }
  });

  it("documents c2x init --pipeline and Claude skill install", () => {
    const readme = readFileSync(path.join(process.cwd(), "README.md"), "utf8");
    const skill = readFileSync(path.join(process.cwd(), "skill/SKILL.md"), "utf8");
    const cli = readFileSync(path.join(process.cwd(), "src/cli/c2x.ts"), "utf8");
    const install = readFileSync(path.join(process.cwd(), "install.sh"), "utf8");
    expect(cli).toMatch(/\.command\("brainstorm"\)/);
    expect(cli).toMatch(/--pipeline/);
    expect(cli).toMatch(/defaultSkillHomes|defaultClaudeSkillHome/);
    expect(readme).toMatch(/--pipeline/);
    expect(skill).toMatch(/--pipeline|pipeline/);
    expect(skill).toMatch(/ChatGPT \+ Claude Code \+ Codex \+ Grok|pipeline đầy đủ/);
    expect(skill).toMatch(/\.claude\/skills/);
    expect(skill).not.toMatch(/does not auto-install/);
    expect(install).toMatch(/c2x init --harness codex/);
    expect(install).not.toMatch(/c2x init --pipeline/);
  });
});
