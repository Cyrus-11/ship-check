import { mkdir, writeFile } from "node:fs/promises";

await mkdir(".generated");
await writeFile(".generated/build.txt", "build completed\n");
process.stdout.write("test-only-build-stdout\n");
process.stderr.write("test-only-build-stderr\n");
process.exitCode = 0;
