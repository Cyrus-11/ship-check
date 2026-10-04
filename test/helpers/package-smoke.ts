import { deepStrictEqual, ok, strictEqual } from "node:assert";
import { constants } from "node:fs";
import { access, cp, lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { execa } from "execa";

import { isolatedEnvironment, projectFixtures, snapshotFiles, snapshotGit, withProjectFixture } from "./project-fixture.js";

import type { FileSnapshot } from "./project-fixture.js";

// Derive the checkout from the compiled helper, never a user-provided cleanup path.
const repository = fileURLToPath(new URL("../../../", import.meta.url));
let stage = "arguments";
let failureCode: string | undefined;

type Output = { stdout: string; stderr: string; exitCode: number | undefined };

function record(value: unknown): Record<string, unknown> {
  ok(typeof value === "object" && value !== null && !Array.isArray(value), "Expected metadata object");
  // The runtime object check above excludes primitives and arrays.
  return value as Record<string, unknown>;
}

async function manifest(path: string): Promise<Record<string, unknown>> {
  const value: unknown = JSON.parse(await readFile(path, "utf8"));
  return record(value);
}

async function execute(
  file: string, args: string[], cwd: string, env: NodeJS.ProcessEnv, timeout = 30_000,
): Promise<Output> {
  const result = await execa(file, args, {
    cwd, env, extendEnv: false, preferLocal: false, shell: false, stdin: "ignore",
    timeout, maxBuffer: 1_000_000, stripFinalNewline: false, reject: false,
    cleanup: true, killDescendants: true, forceKillAfterDelay: 5_000,
  });
  strictEqual(result.timedOut, false, "Command exceeded its deadline");
  ok(!result.isCanceled && !result.isMaxBuffer, "Command did not complete normally");
  if (result.exitCode !== 0) {
    failureCode = result.stderr.match(/\b(?:ENOTFOUND|ECONNREFUSED|EAI_AGAIN|ENETUNREACH|EPERM|EACCES|ENOTCACHED|ERESOLVE)\b/u)?.[0];
  }
  return { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode };
}

async function successful(
  file: string, args: string[], cwd: string, env: NodeJS.ProcessEnv, timeout = 30_000,
): Promise<string> {
  const output = await execute(file, args, cwd, env, timeout);
  strictEqual(output.exitCode, 0, "Setup command must succeed");
  return output.stdout;
}

function packFiles(stdout: string): string[] {
  const value: unknown = JSON.parse(stdout);
  ok(Array.isArray(value) && value.length === 1, "Expected one packed package");
  const metadata = record(value[0]);
  ok(Array.isArray(metadata.files), "Pack must list files");
  return metadata.files.map((item: unknown): string => {
    const path = record(item).path;
    ok(typeof path === "string", "Pack path must be a string");
    return path;
  }).sort();
}

function assertCli(output: Output, stdout: string, stderr: string, exitCode: number): void {
  strictEqual(output.exitCode, exitCode);
  strictEqual(output.stdout, stdout);
  strictEqual(output.stderr, stderr);
  ok(!/\u001b|\r|\[Nest\]|test-only-|Error:|\bat .+\(.+:\d+:\d+\)/u.test(output.stdout + output.stderr));
}

function withBin(env: NodeJS.ProcessEnv, bin: string): NodeJS.ProcessEnv {
  const child = { ...env };
  const pathKey = Object.keys(child).find((key): boolean => key.toUpperCase() === "PATH") ?? "PATH";
  child[pathKey] = `${bin}${delimiter}${child[pathKey] ?? ""}`;
  return child;
}

function generatedFiles(before: FileSnapshot): FileSnapshot {
  return {
    ...before,
    ".generated": { type: "directory", content: "" },
    ".generated/build.txt": { type: "file", content: Buffer.from("build completed\n").toString("base64") },
    ".generated/test.txt": { type: "file", content: Buffer.from("tests completed with CI=true\n").toString("base64") },
  };
}

async function verifyCli(bin: string, empty: string, env: NodeJS.ProcessEnv, version: string): Promise<void> {
  const command = process.platform === "win32" ? "shipcheck.cmd" : "shipcheck";
  const run = async (args: string[], cwd = empty, childEnv = env): Promise<Output> =>
    execute(command, args, cwd, withBin(childEnv, bin));
  const help = "Usage: shipcheck [options] [command]\n\n" +
    "Check whether a Node.js project is ready to ship\n\nOptions:\n" +
    "  -V, --version   output the version number\n  -h, --help      display help for command\n\n" +
    "Commands:\n  scan [options]  Run release-readiness checks\n";
  const emptyBefore = await snapshotFiles(empty);
  assertCli(await run(["--help"]), help, "", 0);
  assertCli(await run(["--version"]), `${version}\n`, "", 0);
  assertCli(await run(["--unknown"]), "", "Shipcheck received invalid arguments. Run shipcheck --help for usage.\n", 2);
  assertCli(await run(["scan"]), "", "Shipcheck could not scan this directory: package.json was not found.\n" +
    "Run the command from the root of a Node.js project.\n", 2);
  deepStrictEqual(await snapshotFiles(empty), emptyBefore);
  await writeFile(join(empty, "package.json"), '{"version":"99.99.99"}\n');
  const targetBefore = await snapshotFiles(empty);
  assertCli(await run(["--version"]), `${version}\n`, "", 0);
  deepStrictEqual(await snapshotFiles(empty), targetBefore);

  const sourceBefore = await snapshotFiles(projectFixtures);
  for (const name of ["ready", "failing-build"] as const) {
    for (const ci of [false, true]) {
      await withProjectFixture(name, async (fixture): Promise<void> => {
        const failing = name === "failing-build";
        const report = `Shipcheck v${version}\n\nProject: fixture-${name}\nPath: ${fixture.directory}\n\n` +
          "✓ Git          Working tree is clean (main)\n" +
          (failing ? "✗ Build        npm run build failed\n" : "✓ Build        npm run build passed\n") +
          "✓ Tests        npm test passed\n✓ Environment  2 required variables are present\n\n" +
          `Checks: ${failing ? "3 passed, 1 failed" : "4 passed, 0 failed"}, 0 skipped\n` +
          `Release score: ${failing ? 75 : 100}/100\nStatus: ${failing ? "REVIEW" : "READY"}\n` +
          `Release gate: ${failing ? "FAILED" : "PASSED"}\n`;
        assertCli(await run(["scan", ...(ci ? ["--ci"] : [])], fixture.directory, fixture.env),
          report, "", failing && ci ? 1 : 0);
        deepStrictEqual(await snapshotFiles(fixture.directory), generatedFiles(fixture.filesBefore));
        deepStrictEqual(await snapshotGit(fixture), fixture.gitBefore);
      });
    }
  }
  deepStrictEqual(await snapshotFiles(projectFixtures), sourceBefore);
}

async function smoke(): Promise<void> {
  const args = process.argv.slice(2);
  const prepare = args.length === 1 && args[0] === "--prepare";
  const seed = args.length === 2 && args[0] === "--cache" ? args[1] : undefined;
  ok(prepare || (seed !== undefined && isAbsolute(seed)), "Use --prepare or --cache <absolute prepared npm cache>");
  strictEqual(resolve(process.cwd()), resolve(repository), "Run package check from the repository root");
  const root = await mkdtemp(join(tmpdir(), "shipcheck-package-"));
  try {
    const consumer = join(root, "consumer with spaces");
    const empty = join(root, "cwd without manifest");
    await mkdir(consumer);
    await mkdir(empty);
    for (const name of ["empty-config", "npm-user-config", "npm-global-config"]) await writeFile(join(root, name), "");
    const env = { ...isolatedEnvironment(root, consumer), NPM_CONFIG_FETCH_RETRIES: "0", NPM_CONFIG_FETCH_TIMEOUT: "20000" };
    const cache = join(root, "npm-cache");
    if (seed !== undefined) {
      stage = "copy prepared npm cache";
      await cp(seed, cache, { recursive: true });
    }
    stage = "fresh production build";
    await rm(join(repository, "dist"), { recursive: true, force: true });
    await successful(process.execPath, [join(repository, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.build.json"],
      repository, env);
    const source = await manifest(join(repository, "package.json"));
    ok(typeof source.version === "string" && source.version.length > 0);
    strictEqual(source.private, true);
    strictEqual(source.type, "module");
    deepStrictEqual(source.bin, { shipcheck: "./dist/main.js" });
    deepStrictEqual(source.engines, { node: ">=22.12.0" });
    const files = await snapshotFiles(join(repository, "dist"));
    const expected = ["LICENSE", "README.md", "package.json", ...Object.keys(files)
      .filter((path): boolean => files[path]?.type === "file" && path.endsWith(".js"))
      .map((path): string => `dist/${path}`)].sort();
    ok(expected.includes("dist/main.js"));
    stage = "dry-run package contents";
    const dryRun = packFiles(await successful("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], repository, env));
    deepStrictEqual(dryRun, expected);
    stage = "real tarball contents";
    const packed = await successful("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", root], repository, env);
    deepStrictEqual(packFiles(packed), expected);
    const packedJson: unknown = JSON.parse(packed);
    ok(Array.isArray(packedJson));
    const filename = record(packedJson[0]).filename;
    ok(typeof filename === "string" && filename === `shipcheck-${source.version}.tgz`);
    const tarball = join(root, filename);
    await writeFile(join(consumer, "package.json"), '{"name":"test-only-consumer","private":true}\n');
    stage = prepare ? "dependency cache preparation (registry access)" : "offline dependency preparation (check cache contents)";
    process.stdout.write(`Package smoke: ${stage}\n`);
    await successful("npm", ["install", tarball, "--ignore-scripts", "--no-audit", "--no-fund", "--strict-peer-deps"], consumer,
      { ...env, NPM_CONFIG_OFFLINE: prepare ? "false" : "true" }, 120_000);
    const lockBefore = await readFile(join(consumer, "package-lock.json"));
    stage = "offline clean tarball installation";
    process.stdout.write(`Package smoke: ${stage}\n`);
    await rm(join(consumer, "node_modules"), { recursive: true, force: true });
    await successful("npm", ["ci", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--strict-peer-deps"], consumer, env, 120_000);
    deepStrictEqual(await readFile(join(consumer, "package-lock.json")), lockBefore);
    await successful("npm", ["ls", "--omit=dev", "--all"], consumer, env);
    stage = "installed runtime and launcher";
    const installed = join(consumer, "node_modules", "shipcheck");
    strictEqual((await lstat(installed)).isSymbolicLink(), false);
    const installedFiles = await snapshotFiles(installed);
    ok(Object.values(installedFiles).every((entry): boolean => entry.type !== "symlink"));
    deepStrictEqual(Object.keys(installedFiles).filter((path): boolean => installedFiles[path]?.type === "file").sort(), expected);
    for (const path of expected) {
      deepStrictEqual(await readFile(join(installed, path)), await readFile(join(repository, path)));
    }
    const main = join(installed, "dist", "main.js");
    ok((await readFile(main, "utf8")).startsWith("#!/usr/bin/env node\n"));
    const bin = join(consumer, "node_modules", ".bin");
    if (process.platform === "win32") {
      const launcher = await readFile(join(bin, "shipcheck.cmd"), "utf8");
      ok(/shipcheck[\\/]dist[\\/]main\.js/u.test(launcher));
    } else {
      strictEqual((await lstat(join(bin, "shipcheck"))).isSymbolicLink(), true);
      strictEqual(await realpath(join(bin, "shipcheck")), await realpath(main));
      await access(main, constants.X_OK);
    }
    stage = "installed executable reports and exits";
    await verifyCli(bin, empty, env, source.version);
    process.stdout.write(`Package smoke passed: ${expected.length} files; help/version, READY and REVIEW local/CI, fatal exits; ${process.platform} ${process.version}.\n`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

try {
  await smoke();
} catch {
  // npm errors and assertions can carry raw output; print only the owned stage label.
  process.stderr.write(`Package smoke failed during ${stage}${failureCode === undefined ? "" : ` (${failureCode})`}. ` +
    "Use --prepare for registry cache preparation or --cache with a complete npm cache.\n");
  process.exitCode = 1;
}
