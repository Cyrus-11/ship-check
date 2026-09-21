export type ProcessRequest = {
  file: string;
  args: string[];
  cwd: string;
  /** Overrides inherited variables; undefined removes a variable. */
  env?: NodeJS.ProcessEnv;
  timeoutMs: number;
};
