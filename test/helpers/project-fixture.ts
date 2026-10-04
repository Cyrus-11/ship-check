import { strictEqual } from "node:assert";
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, readlink, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { execa } from "execa";

export type ProjectFixtureName = "ready" | "dirty-git" | "failing-build" | "failing-test"
  | "missing-env" | "no-env-example" | "invalid-project";
export type FileSnapshot = Record<string, { type: "directory" | "file" | "symlink"; content: string }>;
export type GitSnapshot = { head: string; staged: string; status: string };
export type ProjectFixture = {
  directory: string;
  env: NodeJS.ProcessEnv;
  filesBefore: FileSnapshot;
  gitBefore: GitSnapshot | undefined;
};

export const projectFixtures = resolve("test/fixtures/projects");
const entry = resolve("dist/main.js");

// Inspect ignored generated files too; Git status alone cannot detect their mutation.
export async function snapshotFiles(directory: string): Promise<FileSnapshot> {
  const entries: FileSnapshot = {};
  async function visit(relative: string): Promise<void> {
    for (const name of (await readdir(join(directory, relative))).sort()) {
      if (relative === "" && name === ".git") continue;
      const path = relative === "" ? name : `${relative}/${name}`;
      const absolute = join(directory, path);
      const stat = await lstat(absolute);
      if (stat.isSymbolicLink()) {
        entries[path] = { type: "symlink", content: await readlink(absolute) };
      } else if (stat.isDirectory()) {
        entries[path] = { type: "directory", content: "" };
        await visit(path);
      } else {
        entries[path] = { type: "file", content: (await readFile(absolute)).toString("base64") };
      }
    }
  }
  await visit("");
  return entries;
}

export function isolatedEnvironment(root: string, directory: string): NodeJS.ProcessEnv {
  const env = { ...process.env };
  // Remove inherited tool configuration case-insensitively, including on Windows.
  for (const key of Object.keys(env)) {
    if (/^(?:GIT_|NPM_CONFIG_|SHIPCHECK_|NODE_OPTIONS$|NODE_PATH$|CI$|FORCE_COLOR$)/iu.test(key)) {
      delete env[key];
    }
  }
  return {
    ...env,
    NO_COLOR: "1",
    GIT_CONFIG_GLOBAL: join(root, "empty-config"),
    GIT_CONFIG_SYSTEM: join(root, "empty-config"),
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_TERMINAL_PROMPT: "0",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_CEILING_DIRECTORIES: dirname(directory),
    NPM_CONFIG_USERCONFIG: join(root, "npm-user-config"),
    NPM_CONFIG_GLOBALCONFIG: join(root, "npm-global-config"),
    NPM_CONFIG_CACHE: join(root, "npm-cache"),
    NPM_CONFIG_OFFLINE: "true",
    NPM_CONFIG_AUDIT: "false",
    NPM_CONFIG_FUND: "false",
    NPM_CONFIG_UPDATE_NOTIFIER: "false",
  };
}

async function git(directory: string, env: NodeJS.ProcessEnv, args: string[]): Promise<string> {
  const result = await execa("git", args, {
    cwd: directory, env, extendEnv: false, shell: false, stdin: "ignore",
    timeout: 10_000, maxBuffer: 1_000_000, stripFinalNewline: false, reject: false,
  });
  // Avoid copying command output into a setup error.
  strictEqual(result.failed, false, "Fixture Git command must complete successfully");
  return result.stdout;
}

export async function snapshotGit(fixture: ProjectFixture): Promise<GitSnapshot> {
  const { directory, env } = fixture;
  const [head, staged, status] = await Promise.all([
    git(directory, env, ["rev-parse", "HEAD"]),
    git(directory, env, ["diff", "--cached", "--binary"]),
    git(directory, env, ["status", "--porcelain", "--untracked-files=all"]),
  ]);
  return { head, staged, status };
}

export async function withProjectFixture(
  name: ProjectFixtureName,
  use: (fixture: ProjectFixture) => Promise<void>,
  malformedManifest = false,
): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "shipcheck-fixtures-"));
  try {
    const copy = join(root, "project with spaces");
    await cp(join(projectFixtures, name), copy, { recursive: true });
    const directory = await realpath(copy);
    const env = isolatedEnvironment(await realpath(root), directory);
    await writeFile(join(root, "empty-config"), "");
    await writeFile(join(root, "npm-user-config"), "");
    await writeFile(join(root, "npm-global-config"), "");
    await mkdir(join(root, "empty-template"));
    if (name === "invalid-project") {
      if (malformedManifest) {
        await writeFile(join(directory, "package.json"), "test-only-invalid-manifest {\n");
      }
    } else {
      if (name !== "no-env-example") {
        await cp(join(directory, "environment.seed"), join(directory, ".env"));
        if (name !== "missing-env") {
          await cp(join(directory, "local-environment.seed"), join(directory, ".env.local"));
        }
      }
      await git(directory, env, ["init", "--initial-branch=main", `--template=${join(root, "empty-template")}`]);
      await git(directory, env, ["add", "."]);
      await git(directory, env, ["-c", "user.name=Test Only", "-c", "user.email=test-only@example.com",
        "-c", "commit.gpgsign=false", "commit", "-m", "fixture baseline"]);
      if (name === "dirty-git") {
        await writeFile(join(directory, "test-only-untracked-path.txt"), "test-only dirty content\n");
      }
    }
    const fixture: ProjectFixture = {
      directory, env, filesBefore: await snapshotFiles(directory), gitBefore: undefined,
    };
    if (name !== "invalid-project") fixture.gitBefore = await snapshotGit(fixture);
    await use(fixture);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

export async function runProjectCli(fixture: ProjectFixture, ci: boolean): Promise<{
  stdout: string; stderr: string; exitCode: number | undefined; timedOut: boolean;
}> {
  const preload = new URL("./reject-network-listen.js", import.meta.url).href;
  const result = await execa(process.execPath, ["--import", preload, entry, "scan", ...(ci ? ["--ci"] : [])], {
    cwd: fixture.directory, env: fixture.env, extendEnv: false, shell: false, stdin: "ignore",
    timeout: 30_000, maxBuffer: 1_000_000, stripFinalNewline: false, reject: false,
    cleanup: true, killDescendants: true, forceKillAfterDelay: 5_000,
  });
  return { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode, timedOut: result.timedOut };
}
