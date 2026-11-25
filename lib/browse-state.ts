import { categories, currencies, type Category, type Region } from "./types";
import type { Sort } from "./filters";

export type BrowseState = {
  query: string;
  category: Category;
  region: Region;
  sort: Sort;
  savedOnly: boolean;
};

export function readBrowseState(search: string): BrowseState {
  const params = new URLSearchParams(search);
  const category = params.get("category");
  const region = params.get("region");
  const sort = params.get("sort");
  const validRegion =
    region && Object.hasOwn(currencies, region) ? (region as Region) : "all";
  return {
    query: params.get("q") ?? "",
    category: categories.includes(category as Category)
      ? (category as Category)
      : "All finds",
    region: validRegion,
    sort:
      sort === "discount" || (sort === "price" && validRegion !== "all")
        ? sort
        : "recent",
    savedOnly: params.get("saved") === "1",
  };
}

export function writeBrowseState(search: string, state: BrowseState): string {
  const params = new URLSearchParams(search);
  const values = {
    q: state.query,
    category: state.category === "All finds" ? "" : state.category,
    region: state.region === "all" ? "" : state.region,
    sort: state.sort === "recent" ? "" : state.sort,
    saved: state.savedOnly ? "1" : "",
  };
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  return params.toString();
}
