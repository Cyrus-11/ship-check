#!/usr/bin/env node

import "reflect-metadata";
import { CommandFactory } from "nest-commander";

import { AppModule } from "./app.module.js";

async function bootstrap(): Promise<void> {
  await CommandFactory.run(AppModule, {
    cliName: "shipcheck",
    usePlugins: false,
    logger: false,
    abortOnError: false,
  });
}

void bootstrap().catch((): void => {
  process.stderr.write("Shipcheck failed to start.\n");
  process.exitCode = 2;
});
