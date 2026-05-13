import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const MAX_SOUL_CHARS = 5000;

export type DoolittleSoul = {
  path?: string;
  text: string;
};

function stripHtmlComments(markdown: string): string {
  return markdown.replace(/<!--[\s\S]*?-->/g, "").trim();
}

export function findDoolittleSoulFile(startDir: string): string | undefined {
  let current = resolve(startDir || process.cwd());
  for (let depth = 0; depth < 8; depth += 1) {
    const candidate = join(current, "SOUL.md");
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return undefined;
}

export function readDoolittleSoul(startDir: string): DoolittleSoul {
  const path = findDoolittleSoulFile(startDir);
  if (!path) {
    return { text: "" };
  }

  try {
    const text = stripHtmlComments(readFileSync(path, "utf8")).slice(
      0,
      MAX_SOUL_CHARS,
    );
    return { path, text };
  } catch {
    return { path, text: "" };
  }
}

export function renderDoolittleSoulContext(startDir: string): string[] {
  const soul = readDoolittleSoul(startDir);
  if (!soul.text.trim()) {
    return [];
  }
  return [
    "Doolittle soul (SOUL.md):",
    ...(soul.path ? [`- source=${soul.path}`] : []),
    ...soul.text.split(/\r?\n/).map((line) => `> ${line}`),
  ];
}
