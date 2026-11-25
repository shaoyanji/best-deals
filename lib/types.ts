export const categories = [
  "All finds",
  "Tech",
  "Home & living",
  "Style",
  "Gaming",
  "Outdoors",
  "Everyday",
] as const;
export type Category = (typeof categories)[number];
export type Region = "all" | "US" | "UK";
export type Deal = {
  id: string;
  title: string;
  description: string;
  url: string;
  image: string | null;
  source: "Slickdeals" | "HotUKDeals" | "DealNews";
  merchant: string;
  region: "US" | "UK";
  currency: "USD" | "GBP";
  price: number | null;
  discount: number | null;
  upTo: boolean;
  category: Category;
  publishedAt: string;
  expiresAt: string | null;
};
export type Feed = {
  deals: Deal[];
  updatedAt: string;
  /** Last refresh attempt, including failures; optional for older cache entries. */
  checkedAt?: string;
  stale: boolean;
  unavailableSources: string[];
  storage: "supabase" | "memory";
};
