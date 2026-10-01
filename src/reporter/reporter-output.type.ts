export type ReporterOutput = {
  readonly stdout: NodeJS.WritableStream;
  readonly writeStdout: (text: string) => Promise<void>;
  readonly writeStderr: (text: string) => Promise<void>;
};
