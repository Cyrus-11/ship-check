export class ProcessStartError extends Error {
  public constructor(options?: ErrorOptions) {
    super("Unable to start the requested process.", options);
    this.name = "ProcessStartError";
  }
}
