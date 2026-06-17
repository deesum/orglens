import { spawnSync } from "node:child_process";

export interface ProcessResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export function runCommand(command: string, args: string[], cwd: string): ProcessResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: process.env,
  });

  return {
    ok: result.status === 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status,
  };
}
