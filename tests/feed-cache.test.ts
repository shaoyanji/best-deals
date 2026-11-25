import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

const run = promisify(execFile);

for (const scenario of [
  "memory",
  "shared-read",
  "shared-failure",
  "shared-empty",
  "legacy",
]) {
  test(`feed refresh backoff: ${scenario}`, async () => {
    // Each process represents an independent serverless instance. The server-only
    // module is imported under its server condition, never in a browser bundle.
    await run(process.execPath, [
      "--conditions=react-server",
      "--import=tsx",
      "tests/feed-cache-scenario.ts",
      scenario,
    ]);
  });
}
