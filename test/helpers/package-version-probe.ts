const { readPackageVersion }: { readPackageVersion: (url: URL) => Promise<string> } = await import(
  new URL("../../../dist/common/package-version.js", import.meta.url).href
);

const metadataUrl = process.argv[2];
if (metadataUrl === undefined) {
  throw new Error("The metadata probe requires a URL");
}

try {
  process.stdout.write(`${await readPackageVersion(new URL(metadataUrl))}\n`);
} catch {
  process.stderr.write("Package metadata rejected\n");
  process.exitCode = 2;
}

export {};
