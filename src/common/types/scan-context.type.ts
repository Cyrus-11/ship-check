import type { PackageJson } from "./package-json.type.js";

export type ScanContext = {
  readonly cwd: string;
  readonly projectName: string;
  readonly packageJsonPath: string;
  readonly packageJson: PackageJson;
  readonly ci: boolean;
};
