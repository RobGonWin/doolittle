import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DevinCliPrintParams } from "./types";

export const DEFAULT_DEVIN_COMMAND = "devin";
export const DEFAULT_DEVIN_MODEL = "swe-1-6-fast";
export const DEFAULT_DEVIN_TIMEOUT_MS = 120_000;
const ANSI_ESCAPE_PATTERN = new RegExp(
  `${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`,
  "gu",
);

function stripAnsi(value: string): string {
  return value.replace(ANSI_ESCAPE_PATTERN, "");
}

async function runDevinProcess(
  command: string,
  args: string[],
  params: DevinCliPrintParams,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timeoutMs = params.timeoutMs ?? DEFAULT_DEVIN_TIMEOUT_MS;
    const child = spawn(command, args, {
      cwd: params.cwd,
      env: {
        ...process.env,
        DEVIN_MODEL: params.model,
        DEVIN_PERMISSION_MODE: params.permissionMode ?? "auto",
        NO_COLOR: "1",
      },
      windowsHide: true,
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const cleanStdout = stripAnsi(stdout).trim();
      const cleanStderr = stripAnsi(stderr).trim();
      if (timedOut) {
        reject(
          new Error(
            `Devin CLI invocation timed out after ${timeoutMs}ms. Partial output: ${
              cleanStdout || cleanStderr || "none"
            }`,
          ),
        );
        return;
      }
      if (code !== 0) {
        const detail = [cleanStdout, cleanStderr]
          .filter(Boolean)
          .join("\n")
          .trim();
        reject(
          new Error(
            `Devin CLI invocation failed${
              typeof code === "number" ? ` (${code})` : ""
            }${signal ? ` signal=${signal}` : ""}: ${
              detail || "Unknown error"
            }`,
          ),
        );
        return;
      }
      resolve(cleanStdout || cleanStderr);
    });
  });
}

export async function invokeDevinCliPrint(
  params: DevinCliPrintParams,
): Promise<string> {
  const command = params.command?.trim() || DEFAULT_DEVIN_COMMAND;
  const model = params.model?.trim() || DEFAULT_DEVIN_MODEL;
  const permissionMode = params.permissionMode ?? "auto";
  const tempDir = await mkdtemp(join(tmpdir(), "doolittle-devin-"));
  try {
    const promptFile = join(tempDir, "prompt.txt");
    await writeFile(promptFile, params.prompt, "utf8");
    return await runDevinProcess(
      command,
      [
        "-p",
        "--model",
        model,
        "--permission-mode",
        permissionMode,
        "--prompt-file",
        promptFile,
      ],
      {
        ...params,
        model,
        permissionMode,
      },
    );
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}
