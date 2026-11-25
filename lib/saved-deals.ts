import { categories, type Deal } from "./types";

export const savedDealsKey = "bestdeals:saved:v1";
export const savedDealPrefix = "bestdeals:saved:v2:";
type SavedStorage = Pick<Storage, "getItem" | "setItem" | "key" | "length">;

function httpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isDeal(value: unknown): value is Deal {
  if (!value || typeof value !== "object") return false;
  const d = value as Record<string, unknown>;
  const numberOrNull = (n: unknown) =>
    n === null || (typeof n === "number" && Number.isFinite(n) && n >= 0);
  return (
    typeof d.id === "string" &&
    typeof d.title === "string" &&
    typeof d.description === "string" &&
    typeof d.merchant === "string" &&
    httpsUrl(d.url) &&
    (d.image === null || httpsUrl(d.image)) &&
    ["Slickdeals", "HotUKDeals", "DealNews"].includes(d.source as string) &&
    ["US", "UK"].includes(d.region as string) &&
    ["USD", "GBP"].includes(d.currency as string) &&
    categories.includes(d.category as Deal["category"]) &&
    numberOrNull(d.price) &&
    numberOrNull(d.discount) &&
    typeof d.upTo === "boolean" &&
    typeof d.publishedAt === "string" &&
    Number.isFinite(Date.parse(d.publishedAt)) &&
    (d.expiresAt === null ||
      (typeof d.expiresAt === "string" &&
        Number.isFinite(Date.parse(d.expiresAt))))
  );
}

export function parseSavedDeals(raw: string | null): Deal[] {
  let stored: unknown;
  try {
    stored = JSON.parse(raw ?? "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(stored)) return [];
  return stored
    .filter(isDeal)
    .filter((d, i, all) => all.findIndex((other) => other.id === d.id) === i);
}

export function readSavedDeals(storage: SavedStorage): Deal[] {
  const deals = new Map(
    parseSavedDeals(storage.getItem(savedDealsKey)).map((d) => [d.id, d]),
  );
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(savedDealPrefix)) continue;
    try {
      const id = decodeURIComponent(key.slice(savedDealPrefix.length));
      const record: unknown = JSON.parse(storage.getItem(key) ?? "null");
      if (record === null) deals.delete(id);
      else if (isDeal(record) && record.id === id) deals.set(id, record);
    } catch {
      // One malformed record must not hide the rest of the shortlist.
    }
  }
  return [...deals.values()];
}

// Each operation writes exactly one key. Even serialized localStorage reads
// can be stale in another renderer, so never rewrite the entire collection.
// Tombstones override legacy array entries without resurrecting removed finds.
export function updateSavedDeal(
  storage: SavedStorage,
  deal: Deal,
  save: boolean,
) {
  storage.setItem(
    savedDealPrefix + encodeURIComponent(deal.id),
    JSON.stringify(save ? deal : null),
  );
  return readSavedDeals(storage);
}

export type SavedAvailability = "expired" | "unlisted" | null;
export function savedAvailability(
  deal: Deal,
  live: Deal[],
  now: number,
): SavedAvailability {
  if (deal.expiresAt && Date.parse(deal.expiresAt) <= now) return "expired";
  return live.some((d) => d.id === deal.id) ? null : "unlisted";
}
