import { Server } from "node:net";

// Loaded only in the CLI smoke-test subprocess, never in the test runner.
Server.prototype.listen = (): never => {
  throw new Error("The CLI must not open a network listener");
};
