import test from "node:test";
import assert from "node:assert/strict";
import { refreshFeed } from "../lib/refresh-feed";

test("a stalled refresh aborts and a new request can recover", async (t) => {
  let stalledSignal: AbortSignal | undefined;
  const fetchMock = t.mock.method(
    globalThis,
    "fetch",
    async (_url, options) => {
      stalledSignal = options.signal;
      return new Promise<Response>((_resolve, reject) => {
        stalledSignal!.addEventListener("abort", () =>
          reject(stalledSignal!.reason),
        );
      });
    },
  );
  await assert.rejects(refreshFeed(20), /connection is taking too long/);
  assert.equal(stalledSignal?.aborted, true);

  const feed = {
    deals: [],
    updatedAt: new Date().toISOString(),
    stale: false,
    unavailableSources: [],
    storage: "memory",
  };
  fetchMock.mock.mockImplementation(async () => Response.json(feed));
  assert.deepEqual(await refreshFeed(), feed);
});

test("the timeout also bounds a response body that never finishes", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"deals":['));
          options.signal.addEventListener("abort", () =>
            controller.error(options.signal.reason),
          );
        },
      }),
    );
  });
  await assert.rejects(refreshFeed(20), /connection is taking too long/);
});

test("HTTP failures and invalid JSON reject rather than replacing the current feed", async (t) => {
  const fetchMock = t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("Unavailable", { status: 503 }),
  );
  await assert.rejects(refreshFeed(), /Refresh failed/);
  fetchMock.mock.mockImplementation(async () => new Response("not JSON"));
  await assert.rejects(refreshFeed(), SyntaxError);
});
