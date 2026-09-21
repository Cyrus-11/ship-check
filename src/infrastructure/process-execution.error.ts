export class ProcessExecutionError extends Error {
  public constructor(
    public readonly reason: "invalid_request" | "output_limit" | "signal" | "adapter",
    options?: ErrorOptions,
  ) {
    super("Unable to complete the requested process.", options);
    this.name = "ProcessExecutionError";
  }
}
