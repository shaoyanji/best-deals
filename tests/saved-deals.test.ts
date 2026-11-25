import test from "node:test";
import assert from "node:assert/strict";
import {
  parseSavedDeals,
  readSavedDeals,
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
    get length() {
      return entries.size;
    },
    key: (index: number) => [...entries.keys()][index] ?? null,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
  };
}

test("German listings and in-store labels survive saving", () => {
  const shared = storage();
  const germanListings = [
    {
      ...deal,
      id: "fuchs",
      source: "Schnäppchenfuchs",
      region: "DE",
      currency: "EUR",
    },
    {
      ...deal,
      id: "doktor",
      source: "DealDoktor",
      region: "DE",
      currency: "EUR",
    },
    {
      ...deal,
      id: "community",
      source: "DealDoktor Community",
      region: "DE",
      currency: "EUR",
      inStore: true,
    },
  ] satisfies Deal[];
  for (const listing of germanListings) updateSavedDeal(shared, listing, true);
  assert.deepEqual(readSavedDeals(shared), germanListings);
});

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
  assert.deepEqual(readSavedDeals(shared), next);
});

test("stale save/remove intentions preserve other tabs' changes and are idempotent", () => {
  const shared = storage();
  const another = { ...deal, id: "another" };
  updateSavedDeal(shared, deal, true);
  updateSavedDeal(shared, another, true);
  updateSavedDeal(shared, deal, true);
  assert.equal(readSavedDeals(shared).length, 2);
  updateSavedDeal(shared, deal, false);
  assert.deepEqual(updateSavedDeal(shared, deal, false), [another]);
});

test("full snapshots persist across reloads without age-based deletion", () => {
  const shared = storage();
  const old = { ...deal, publishedAt: "2020-01-01T00:00:00Z" };
  updateSavedDeal(shared, old, true);
  assert.deepEqual(readSavedDeals(shared), [old]);
  assert.equal(savedAvailability(old, [], Date.now()), "unlisted");
});

test("legacy saved arrays stay readable and removed entries cannot be resurrected by legacy writes", () => {
  const shared = storage();
  shared.setItem(savedDealsKey, JSON.stringify([deal]));
  assert.deepEqual(readSavedDeals(shared), [deal]);
  updateSavedDeal(shared, deal, false);
  const another = { ...deal, id: "another" };
  // An old app tab still rewrites its stale v1 collection.
  shared.setItem(savedDealsKey, JSON.stringify([deal, another]));
  assert.deepEqual(readSavedDeals(shared), [another]);
  assert.deepEqual(
    updateSavedDeal(shared, deal, true)
      .map((d) => d.id)
      .sort(),
    ["another", deal.id],
  );
});

test("independent mutations survive stale renderer-local storage snapshots", () => {
  const canonical = storage();
  const another = { ...deal, id: "another" };
  function replica() {
    const local = storage();
    for (let i = 0; i < canonical.length; i++) {
      const key = canonical.key(i)!;
      local.setItem(key, canonical.getItem(key)!);
    }
    return {
      get length() {
        return local.length;
      },
      key: local.key,
      getItem: local.getItem,
      setItem: (key: string, value: string) => {
        local.setItem(key, value);
        canonical.setItem(key, value);
      },
    };
  }
  // Both renderers initially see empty storage, even after the other writes.
  const first = replica();
  const second = replica();
  updateSavedDeal(first, deal, true);
  updateSavedDeal(second, another, true);
  assert.deepEqual(
    readSavedDeals(canonical)
      .map((d) => d.id)
      .sort(),
    ["another", deal.id],
  );
  const removeFirst = replica();
  const removeSecond = replica();
  updateSavedDeal(removeFirst, deal, false);
  updateSavedDeal(removeSecond, another, false);
  assert.deepEqual(readSavedDeals(canonical), []);
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
          length: 0,
          key: () => null,
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
