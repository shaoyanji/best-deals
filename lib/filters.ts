import type { Category, Deal, Region } from "./types";
export type Sort = "recent" | "discount" | "price";
export function filterDeals(
  deals: Deal[],
  query: string,
  category: Category,
  region: Region,
  sort: Sort,
  saved?: string[],
) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return deals
    .filter(
      (deal) =>
        (category === "All finds" || deal.category === category) &&
        (region === "all" || deal.region === region) &&
        (!saved || saved.includes(deal.id)) &&
        words.every((word) =>
          `${deal.title} ${deal.merchant} ${deal.category} ${deal.source}`
            .toLowerCase()
            .includes(word),
        ),
    )
    .sort((a, b) => {
      if (sort === "discount") return (b.discount ?? -1) - (a.discount ?? -1);
      // A mixed-currency price sort is intentionally not offered by the UI.
      if (sort === "price")
        return (a.price ?? Infinity) - (b.price ?? Infinity);
      return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
    });
}
