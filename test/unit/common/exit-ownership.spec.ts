import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Only the command and bootstrap layers own process exit state.
const exitOwners = ["bootstrap.ts", "commands/scan.command.ts"];

async function sourceFiles(): Promise<string[]> {
  const files = await readdir("src", { recursive: true });
  return files
    .map((file): string => file.replaceAll("\\", "/"))
    .filter((file): boolean => file.endsWith(".ts"))
    .sort();
}

describe("exit ownership", (): void => {
  it("never terminates the process directly", async (): Promise<void> => {
    for (const file of await sourceFiles()) {
      expect(await readFile(join("src", file), "utf8"), file).not.toMatch(/process\.exit\s*\(/u);
    }
  });

  it("references process exit state only from the command and bootstrap", async (): Promise<void> => {
    const references: string[] = [];
    for (const file of await sourceFiles()) {
      if (/process\.exitCode/u.test(await readFile(join("src", file), "utf8"))) references.push(file);
    }
    expect(references).toEqual(exitOwners);
  });
});
