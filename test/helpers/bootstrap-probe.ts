import "reflect-metadata";

import { setTimeout } from "node:timers/promises";

import { Module } from "@nestjs/common";

import type { Type } from "@nestjs/common";
import type { CommandRunner } from "nest-commander";

const mode = process.env.SHIPCHECK_TEST_PROBE;

// This preload decorates the actual production module, not the test build copy.
const { AppModule }: { AppModule: Type<unknown> } = await import(
  new URL("../../../dist/app.module.js", import.meta.url).href
);

class BootstrapProbe {
  public constructor() {
    if (mode === "startup") {
      throw new Error("test-only-secret-startup");
    }
  }

  public async onModuleDestroy(): Promise<void> {
    await setTimeout(5);
    process.stderr.write("probe:destroyed\n");
  }

  public async onApplicationShutdown(): Promise<void> {
    await setTimeout(5);
    process.stderr.write("probe:shutdown\n");
    if (mode === "cleanup") {
      throw new Error("test-only-secret-cleanup");
    }
  }
}

// Module only replaces the provided metadata key, preserving the real imports.
Module({ providers: [BootstrapProbe] })(AppModule);

if (mode === "execution" || mode === "lookalike") {
  const { RootCommand }: { RootCommand: Type<CommandRunner> } = await import(
    new URL("../../../dist/commands/root.command.js", import.meta.url).href
  );
  RootCommand.prototype.run = async (): Promise<void> => {
    const failure = new Error("test-only-secret-execution");
    // A command error resembling a help signal must still fail.
    if (mode === "lookalike") {
      Object.assign(failure, { code: "commander.helpDisplayed", exitCode: 0 });
    }
    throw failure;
  };
}
