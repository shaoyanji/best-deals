import test from "node:test";
import assert from "node:assert/strict";
import { readBrowseState, writeBrowseState } from "../lib/browse-state";

test("UK browsing context survives URL round trips, including spaces and symbols", () => {
  const state = {
    query: "soundcore & case",
    category: "Home & living" as const,
    region: "UK" as const,
    sort: "price" as const,
    savedOnly: true,
  };
  const search = writeBrowseState("?campaign=summer", state);
  assert.equal(new URLSearchParams(search).get("campaign"), "summer");
  assert.deepEqual(readBrowseState(search), state);
});

test("invalid filters and mixed-currency price sorts fall back safely", () => {
  assert.deepEqual(
    readBrowseState("?category=unknown&region=FR&sort=price&saved=false"),
    {
      query: "",
      category: "All finds",
      region: "all",
      sort: "recent",
      savedOnly: false,
    },
  );
  assert.equal(readBrowseState("?region=UK&sort=price").sort, "price");
  assert.equal(readBrowseState("?sort=discount").sort, "discount");
});

test("Germany is a shareable region filter", () => {
  const state = readBrowseState("?region=DE&saved=1");
  assert.equal(state.region, "DE");
  assert.equal(writeBrowseState("", state), "region=DE&saved=1");
});

test("clearing search and category keeps the chosen UK region", () => {
  const state = readBrowseState("?q=washing+machine&category=Style&region=UK");
  const search = writeBrowseState(
    "?q=washing+machine&category=Style&region=UK",
    {
      ...state,
      query: "",
      category: "All finds",
    },
  );
  assert.equal(search, "region=UK");
  assert.equal(writeBrowseState(search, readBrowseState("")), "");
});
