import test from "node:test";
import assert from "node:assert/strict";
import {
  parseSavedDeals,
  savedAvailability,
  savedDealsKey,
  updateSavedDeal,
} from "../lib/saved-deals";
import type { Deal } from "../lib/types";

const deal: Deal = {
  id: "saved-test",
  title: "Saved listing",
  description: "Test record",
  url: "https://example.com/listing",
  image: null,
  source: "Slickdeals",
  merchant: "Test merchant",
  region: "US",
  currency: "USD",
  price: null,
  discount: null,
  upTo: false,
  category: "Tech",
  publishedAt: "2026-11-25T10:00:00Z",
  expiresAt: null,
};
function storage() {
  const entries = new Map<string, string>();
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
  };
}

test("a stale tab saving a different listing does not resurrect a removed find", () => {
  const shared = storage();
  const tabOne = updateSavedDeal(shared, deal, true);
  updateSavedDeal(shared, deal, false); // Tab two removes it.
  assert.equal(tabOne.length, 1); // Tab one's rendered state is still stale.
  const another = { ...deal, id: "another" };
  const next = updateSavedDeal(shared, another, true);
  assert.deepEqual(
    next.map((d) => d.id),
    [another.id],
  );
  assert.deepEqual(parseSavedDeals(shared.getItem(savedDealsKey)), next);
});

test("stale save/remove intentions preserve other tabs' changes and are idempotent", () => {
  const shared = storage();
  const another = { ...deal, id: "another" };
  updateSavedDeal(shared, deal, true);
  updateSavedDeal(shared, another, true);
  updateSavedDeal(shared, deal, true);
  assert.equal(parseSavedDeals(shared.getItem(savedDealsKey)).length, 2);
  updateSavedDeal(shared, deal, false);
  assert.deepEqual(updateSavedDeal(shared, deal, false), [another]);
});

test("full snapshots persist across reloads without age-based deletion", () => {
  const shared = storage();
  const old = { ...deal, publishedAt: "2020-01-01T00:00:00Z" };
  updateSavedDeal(shared, old, true);
  assert.deepEqual(parseSavedDeals(shared.getItem(savedDealsKey)), [old]);
  assert.equal(savedAvailability(old, [], Date.now()), "unlisted");
});

test("corrupted or incomplete storage cannot crash filters or price formatting", () => {
  assert.deepEqual(parseSavedDeals("not json"), []);
  assert.deepEqual(parseSavedDeals("{}"), []);
  assert.deepEqual(parseSavedDeals(null), []);
  assert.deepEqual(
    parseSavedDeals(
      JSON.stringify([
        deal,
        deal,
        null,
        { id: "incomplete", title: "Missing fields", url: deal.url },
        { ...deal, id: "unsafe", url: "javascript:alert(1)" },
        { ...deal, id: "badcurrency", currency: "invalid" },
      ]),
    ),
    [deal],
  );
});

test("known expiration is distinct from absence in a rolling feed", () => {
  const now = Date.parse("2026-11-25T12:00:00Z");
  const expires = { ...deal, expiresAt: "2026-11-25T12:00:00Z" };
  assert.equal(savedAvailability(expires, [expires], now - 1), null);
  assert.equal(savedAvailability(expires, [expires], now), "expired");
  assert.equal(savedAvailability(deal, [], now), "unlisted");
  assert.equal(savedAvailability(deal, [deal], now), null);
});

test("storage failures reach the caller so the UI can disclose visit-only persistence", () => {
  assert.throws(
    () =>
      updateSavedDeal(
        {
          getItem: () => null,
          setItem: () => {
            throw new Error("Quota exceeded");
          },
        },
        deal,
        true,
      ),
    /Quota exceeded/,
  );
});
