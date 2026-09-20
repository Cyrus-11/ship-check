export async function readPackageVersion(
  metadataUrl: URL = new URL("../../package.json", import.meta.url),
): Promise<string> {
  // This is Shipcheck's installed manifest, never the scanned project's files.
  const metadata: unknown = await import(metadataUrl.href, { with: { type: "json" } });

  if (typeof metadata === "object" && metadata !== null && "default" in metadata) {
    const manifest: unknown = metadata.default;
    if (typeof manifest === "object" && manifest !== null && "version" in manifest &&
      typeof manifest.version === "string" && manifest.version.trim().length > 0) {
      return manifest.version;
    }
  }

  throw new Error("Shipcheck package version is missing or invalid");
}
