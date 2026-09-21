import { access, readFile, stat } from "node:fs/promises";
import { isAbsolute, win32 } from "node:path";

import { Injectable } from "@nestjs/common";

const DEFAULT_PATH_EXT = ".COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC";

@Injectable()
export class FileSystem {
  public async readText(absolutePath: string): Promise<string> {
    this.requireAbsolute(absolutePath);
    return readFile(absolutePath, "utf8");
  }

  public async exists(absolutePath: string): Promise<boolean> {
    this.requireAbsolute(absolutePath);
    try {
      await access(absolutePath);
      return true;
    } catch (error: unknown) {
      if (this.isMissing(error)) return false;
      throw error;
    }
  }

  /** Windows lookup only; callers decide which launcher formats they support. */
  public async resolveWindowsExecutable(
    file: string,
    cwd: string,
    env: NodeJS.ProcessEnv,
  ): Promise<string | undefined> {
    if (!win32.isAbsolute(cwd) || file.length === 0) {
      throw new TypeError("Executable lookup requires a file and absolute directory.");
    }

    const extension = win32.extname(file);
    const pathExt = this.windowsVariable(env, "PATHEXT") || DEFAULT_PATH_EXT;
    const extensions = extension === "" ? pathExt.split(";").filter(Boolean)
      : ["", ...pathExt.split(";").filter(Boolean)];
    const explicitPath = /[\\/:]/.test(file);
    const searchCwd = this.windowsVariable(env, "NODEFAULTCURRENTDIRECTORYINEXEPATH") === undefined
      && this.windowsVariable(process.env, "NODEFAULTCURRENTDIRECTORYINEXEPATH") === undefined;
    const directories = explicitPath ? [cwd] : [
      ...(searchCwd ? [cwd] : []),
      ...(this.windowsVariable(env, "PATH") ?? "").split(";")
        .map((directory): string => directory.startsWith('"') && directory.endsWith('"')
          ? directory.slice(1, -1) : directory)
        .filter((directory): boolean => directory.length > 0),
    ];

    for (const directory of directories) {
      const base = win32.resolve(cwd, directory, file);
      for (const suffix of extensions) {
        const candidate = base + suffix;
        try {
          if ((await stat(candidate)).isFile()) return candidate;
        } catch (error: unknown) {
          if (!this.isMissing(error)) throw error;
        }
      }
    }
    return undefined;
  }

  private windowsVariable(env: NodeJS.ProcessEnv, name: string): string | undefined {
    const key = Object.keys(env).sort().find((key): boolean => key.toUpperCase() === name);
    return key === undefined ? undefined : env[key];
  }

  private requireAbsolute(path: string): void {
    if (!isAbsolute(path)) throw new TypeError("File access requires an absolute path.");
  }

  private isMissing(error: unknown): boolean {
    return error instanceof Error && "code" in error && error.code === "ENOENT";
  }
}
