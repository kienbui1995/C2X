import type { WorkspaceFile } from "@/core/types";

export const DEMO_WORKSPACE_NAME = "nhiem-vu";

export const DEMO_FILES: WorkspaceFile[] = [
  {
    path: "README.md",
    language: "markdown",
    content: `# Nhiệm vụ

Bảng việc nội bộ cho nhóm 6 người. API giả, chưa có database.

Đã biết:
- Bộ lọc trạng thái trên URL không được giữ khi reload.
- POST /api/tasks trả 200 nhưng danh sách không đổi.
- Test e2e chưa cover empty state.
`,
  },
  {
    path: "package.json",
    language: "json",
    content: `{
  "name": "nhiem-vu",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "test": "vitest run"
  }
}
`,
  },
  {
    path: "src/app/page.tsx",
    language: "tsx",
    content: `import { TaskBoard } from "@/components/task-board";
import { getTasks } from "@/lib/tasks";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const tasks = await getTasks();
  return <TaskBoard tasks={tasks} status={status} />;
}
`,
  },
  {
    path: "src/components/task-board.tsx",
    language: "tsx",
    content: `"use client";

import { useMemo, useState } from "react";

type Task = { id: string; title: string; status: "open" | "done" };

export function TaskBoard({
  tasks,
  status,
}: {
  tasks: Task[];
  status?: string;
}) {
  const [draft, setDraft] = useState("");
  const visible = useMemo(() => {
    if (!status) return tasks;
    return tasks.filter((task) => task.status === status);
  }, [tasks, status]);

  async function addTask() {
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: draft }),
    });
    setDraft("");
  }

  return (
    <main>
      <h1>Nhiệm vụ</h1>
      <input value={draft} onChange={(event) => setDraft(event.target.value)} />
      <button type="button" onClick={() => void addTask()}>
        Thêm
      </button>
      <ul>
        {visible.map((task) => (
          <li key={task.id}>{task.title}</li>
        ))}
      </ul>
    </main>
  );
}
`,
  },
  {
    path: "src/lib/tasks.ts",
    language: "ts",
    content: `export type Task = { id: string; title: string; status: "open" | "done" };

const TASKS: Task[] = [
  { id: "t1", title: "Soạn brief Codex", status: "open" },
  { id: "t2", title: "Review diff", status: "done" },
];

export async function getTasks(): Promise<Task[]> {
  return TASKS;
}

export async function createTask(title: string): Promise<Task> {
  const task = { id: crypto.randomUUID(), title, status: "open" as const };
  // BUG: mutates a discarded copy, so the board never sees the new row.
  const copy = [...TASKS];
  copy.push(task);
  return task;
}
`,
  },
  {
    path: "src/app/api/tasks/route.ts",
    language: "ts",
    content: `import { NextResponse } from "next/server";
import { createTask, getTasks } from "@/lib/tasks";

export async function GET() {
  return NextResponse.json(await getTasks());
}

export async function POST(request: Request) {
  const body = (await request.json()) as { title?: string };
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  const task = await createTask(body.title.trim());
  return NextResponse.json(task);
}
`,
  },
  {
    path: "src/components/task-board.test.tsx",
    language: "tsx",
    content: `import { describe, expect, it } from "vitest";
import { DEMO_HINT } from "./task-board.test-hint";

describe("task board", () => {
  it("placeholder until filters and create are tested", () => {
    expect(DEMO_HINT).toContain("empty");
  });
});
`,
  },
  {
    path: "src/components/task-board.test-hint.ts",
    language: "ts",
    content: `export const DEMO_HINT = "Need empty-state and persist-filter tests";
`,
  },
];
