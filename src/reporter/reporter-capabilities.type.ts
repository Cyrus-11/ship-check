export type ReporterCapabilities = {
  readonly stdoutIsTTY: boolean;
  readonly noColor: string | undefined;
  readonly testMode: boolean;
};
