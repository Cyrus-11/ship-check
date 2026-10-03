import { strictEqual } from "node:assert";
import { readFile, writeFile } from "node:fs/promises";

strictEqual(process.env.CI, "true");
strictEqual(await readFile(".generated/build.txt", "utf8"), "build completed\n");
await writeFile(".generated/test.txt", "tests completed with CI=true\n");
process.stdout.write("test-only-test-stdout\n");
process.stderr.write("test-only-test-stderr\n");
process.exitCode = 1;
