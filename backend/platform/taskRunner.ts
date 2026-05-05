import path from "path";
import fs from "fs-extra";
import { runManagedCommand } from "./terminalOrchestrator";

interface TaskConfig {
  tasks: Record<string, string>;
}

function configPath(projectRoot: string): string {
  return path.join(projectRoot, ".leara", "tasks.json");
}

export async function getTaskConfig(projectRoot: string): Promise<TaskConfig> {
  const p = configPath(projectRoot);
  if (!(await fs.pathExists(p))) {
    const defaultConfig: TaskConfig = {
      tasks: {
        dev: "npm run dev",
        build: "npm run build",
        test: "npm test",
        lint: "npm run lint",
      },
    };
    await fs.ensureDir(path.dirname(p));
    await fs.writeJson(p, defaultConfig, { spaces: 2 });
    return defaultConfig;
  }
  return fs.readJson(p);
}

export async function saveTaskConfig(projectRoot: string, config: TaskConfig): Promise<void> {
  const p = configPath(projectRoot);
  await fs.ensureDir(path.dirname(p));
  await fs.writeJson(p, config, { spaces: 2 });
}

export async function runTask(projectRoot: string, taskName: string, approved = true) {
  const cfg = await getTaskConfig(projectRoot);
  const command = cfg.tasks[taskName];
  if (!command) throw new Error(`Task '${taskName}' not found`);
  return runManagedCommand(command, projectRoot, approved);
}
