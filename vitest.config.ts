import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // tsc emits the constructor metadata that Nest injection requires.
    include: [".test-dist/test/**/*.spec.js"],
    restoreMocks: true,
    clearMocks: true,
    mockReset: true,
  },
});
