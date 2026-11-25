import assert from "node:assert/strict";
import { getDealFeed } from "../lib/feed";
import { sources } from "../lib/parse-feed";
import type { Feed } from "../lib/types";

const scenario = process.argv[2];
let now = Date.parse("2026-11-25T12:00:00Z");
Date.now = () => now;
const oldUpdate = new Date(now - 30 * 60_000).toISOString();
let payload: Feed = {
  deals: [],
  updatedAt: oldUpdate,
  checkedAt: new Date(now - 30_000).toISOString(),
  stale: true,
  unavailableSources: sources.map((source) => source.name),
  storage: "supabase",
};
let reads = 0;
let writes = 0;
let upstreamCalls = 0;
let healthy = false;

if (scenario === "memory") {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SECRET_KEY;
} else {
  process.env.SUPABASE_URL = "https://test-cache.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "test-only-service-key";
  if (scenario === "legacy") delete payload.checkedAt;
  if (scenario === "shared-failure" || scenario === "shared-empty")
    payload.checkedAt = oldUpdate;
}

globalThis.fetch = async (input, options) => {
  const url = String(input);
  if (url.startsWith("https://test-cache.supabase.co/")) {
    if (options?.method === "POST") {
      writes++;
      payload = JSON.parse(String(options.body)).payload;
      return new Response(null, { status: 201 });
    }
    reads++;
    return Response.json([{ payload }]);
  }
  assert.ok(sources.some((source) => source.url === url));
  upstreamCalls++;
  if (!healthy && scenario !== "shared-empty") throw new Error("Feed outage");
  const date = new Date(now).toISOString();
  // An invalid item is a successfully fetched feed with no accepted listings.
  return new Response(`<rss><channel><item><title>USB charger</title><link>${scenario === "shared-empty" ? "http://invalid.example" : "https://retailer.example/charger"}</link><pubDate>${date}</pubDate></item></channel></rss>`);
};

async function main() {
  const first = await getDealFeed();
  if (scenario === "shared-read") {
    assert.equal(upstreamCalls, 0, "cold starts honor the shared outage backoff");
    assert.equal(reads, 1);
    assert.equal(writes, 0);
    assert.equal(first.storage, "supabase");
    assert.equal(first.updatedAt, oldUpdate);
    return;
  }
  assert.equal(upstreamCalls, sources.length);
  assert.equal(first.checkedAt, new Date(now).toISOString());
  if (scenario !== "memory") {
    assert.equal(writes, 1, "failed and empty refresh attempts are persisted");
    assert.equal(payload.checkedAt, first.checkedAt);
    assert.equal(first.updatedAt, oldUpdate, "attempts do not imply fresh listings");
  }
  now += 59_999;
  await Promise.all(Array.from({ length: 8 }, () => getDealFeed()));
  assert.equal(upstreamCalls, sources.length, "requests during backoff do not refetch");
  assert.equal(reads, scenario === "memory" ? 0 : 1);

  now += 1;
  healthy = true;
  const recovered = await Promise.all(Array.from({ length: 8 }, () => getDealFeed()));
  assert.equal(upstreamCalls, sources.length * 2, "one shared retry occurs at the boundary");
  if (scenario === "shared-empty") {
    assert.equal(recovered[0].deals.length, 0);
    assert.equal(recovered[0].updatedAt, oldUpdate);
  } else {
    assert.ok(recovered[0].deals.length > 0);
    assert.equal(recovered[0].stale, false);
    assert.equal(recovered[0].updatedAt, new Date(now).toISOString());
    now += 60_000;
    await getDealFeed();
    assert.equal(upstreamCalls, sources.length * 2, "healthy caches keep their longer TTL");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
