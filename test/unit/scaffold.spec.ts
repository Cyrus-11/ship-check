import "reflect-metadata";

import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

import { Test } from "@nestjs/testing";
import { execa } from "execa";
import { describe, expect, it } from "vitest";

import { AppModule } from "../../src/app.module.js";
import { ProbeConsumer } from "../helpers/probe-consumer.js";
import { ProbeDependency } from "../helpers/probe-dependency.js";

describe("project scaffold", (): void => {
  it("declares the executable package and runtime baseline", async (): Promise<void> => {
    const metadata: unknown = JSON.parse(await readFile("package.json", "utf8"));

    expect(metadata).toMatchObject({
      name: "shipcheck",
      version: expect.stringMatching(/^\d+\.\d+\.\d+$/),
      type: "module",
      license: "MIT",
      private: true,
      bin: { shipcheck: "./dist/main.js" },
      engines: { node: ">=22.12.0" },
      files: ["dist", "README.md", "LICENSE"],
    });
  });

  it("emits the executable shebang and keeps tests out of production output", async (): Promise<void> => {
    const entry = await readFile("dist/main.js", "utf8");
    const files = await readdir("dist", { recursive: true });

    expect(entry.split(/\r?\n/, 1)).toEqual(["#!/usr/bin/env node"]);
    expect(files).toContain("app.module.js");
    expect(files.some((file): boolean => /^test[\\/]|\.spec\./.test(file))).toBe(false);
  });

  it("prints help and exits successfully without opening a network listener", async (): Promise<void> => {
    const result = await execa(process.execPath, [
      "--import",
      new URL("../helpers/reject-network-listen.js", import.meta.url).href,
      resolve("dist/main.js"),
      "--help",
    ], {
      cwd: process.cwd(),
      env: { NO_COLOR: "1" },
      timeout: 10_000,
      maxBuffer: 1_000_000,
      reject: false,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage:");
    expect(result.stdout).toContain("--help");
    expect(result.stdout).not.toContain("[Nest]");
    expect(result.stderr).toBe("");
  }, 15_000);

  it("resolves constructor dependencies through emitted decorator metadata", async (): Promise<void> => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      providers: [ProbeDependency, ProbeConsumer],
    }).compile();

    try {
      expect(moduleRef.get(ProbeConsumer).readValue()).toBe("dependency resolved");
    } finally {
      await moduleRef.close();
    }
  });

  it("rejects a missing constructor dependency", async (): Promise<void> => {
    await expect(Test.createTestingModule({
      providers: [ProbeConsumer],
    }).compile()).rejects.toThrow("ProbeDependency");
  });

  it("does not install an HTTP platform adapter", async (): Promise<void> => {
    const lockfile: unknown = JSON.parse(await readFile("package-lock.json", "utf8"));

    expect(lockfile).not.toHaveProperty(["packages", "node_modules/@nestjs/platform-express"]);
    expect(lockfile).not.toHaveProperty(["packages", "node_modules/@nestjs/platform-fastify"]);
  });
});
