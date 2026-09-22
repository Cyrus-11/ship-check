export type DiscoveryFailure = "not_found" | "invalid" | "unreadable";

const NEXT_STEP = "Run the command from the root of a Node.js project.";

const HEADLINE: Record<DiscoveryFailure, string> = {
  not_found: "Shipcheck could not scan this directory: package.json was not found.",
  invalid: "Shipcheck could not scan this directory: package.json is not valid JSON.",
  unreadable: "Shipcheck could not scan this directory: package.json could not be read.",
};

export class ProjectDiscoveryError extends Error {
  // The two-line stderr text; the original cause stays internal and is never displayed.
  public readonly report: string;

  public constructor(
    public readonly reason: DiscoveryFailure,
    options?: ErrorOptions,
  ) {
    super("Shipcheck could not scan this directory.", options);
    this.name = "ProjectDiscoveryError";
    this.report = `${HEADLINE[reason]}\n${NEXT_STEP}\n`;
  }
}
