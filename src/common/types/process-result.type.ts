/** Captured output is private adapter data and must never enter reports. */
export type ProcessResult = {
  /** On timeout only, 1 is a synthetic failure code, not a child exit. */
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};
