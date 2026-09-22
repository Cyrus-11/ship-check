import { basename, join } from "node:path";

import { Injectable } from "@nestjs/common";

import { FileSystem } from "../infrastructure/file-system.service.js";
import { ProjectDiscoveryError } from "./project-discovery.error.js";

import type { PackageJson } from "../common/types/package-json.type.js";
import type { ScanContext } from "../common/types/scan-context.type.js";
import type { ScanReport } from "../common/types/scan-report.type.js";

@Injectable()
export class ScanService {
  public constructor(private readonly fileSystem: FileSystem) {}

  public async scan(options: { ci: boolean }): Promise<Pick<ScanReport, "gatePassed">> {
    await this.discover(options);
    // A shell that has not evaluated any checks cannot approve a release.
    return { gatePassed: false };
  }

  public async discover(options: { ci: boolean }): Promise<ScanContext> {
    // Resolve the target once; scanners receive this context and never re-read cwd.
    const cwd = process.cwd();
    const packageJsonPath = join(cwd, "package.json");
    const raw = await this.readManifest(packageJsonPath);
    const packageJson = this.projectManifest(this.parseManifest(raw));
    const projectName = this.resolveProjectName(packageJson.name, cwd);
    return { cwd, projectName, packageJsonPath, packageJson, ci: options.ci };
  }

  private async readManifest(path: string): Promise<string> {
    try {
      return await this.fileSystem.readText(path);
    } catch (error: unknown) {
      throw new ProjectDiscoveryError(this.isMissing(error) ? "not_found" : "unreadable", {
        cause: error,
      });
    }
  }

  private parseManifest(raw: string): unknown {
    try {
      return JSON.parse(raw) as unknown;
    } catch (error: unknown) {
      throw new ProjectDiscoveryError("invalid", { cause: error });
    }
  }

  private projectManifest(parsed: unknown): PackageJson {
    if (!this.isObject(parsed)) {
      throw new ProjectDiscoveryError("invalid");
    }
    const projection: { name?: string; scripts?: { build?: string; test?: string } } = {};
    if (typeof parsed.name === "string") projection.name = parsed.name;
    const scripts = this.projectScripts(parsed.scripts);
    if (scripts !== undefined) projection.scripts = scripts;
    return projection;
  }

  private projectScripts(scripts: unknown): { build?: string; test?: string } | undefined {
    if (!this.isObject(scripts)) return undefined;
    const projection: { build?: string; test?: string } = {};
    if (typeof scripts.build === "string") projection.build = scripts.build;
    if (typeof scripts.test === "string") projection.test = scripts.test;
    return projection;
  }

  private resolveProjectName(name: string | undefined, cwd: string): string {
    // A missing or blank name falls back to the directory basename without warning.
    if (name !== undefined && name.trim().length > 0) return name;
    return basename(cwd);
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private isMissing(error: unknown): boolean {
    return error instanceof Error && "code" in error && error.code === "ENOENT";
  }
}
