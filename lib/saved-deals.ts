import { categories, type Deal } from "./types";

export const savedDealsKey = "bestdeals:saved:v1";

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

// Read immediately before writing, not from a tab's potentially stale React state.
export function updateSavedDeal(
  storage: Pick<Storage, "getItem" | "setItem">,
  deal: Deal,
  save: boolean,
) {
  const current = parseSavedDeals(storage.getItem(savedDealsKey));
  const others = current.filter((d) => d.id !== deal.id);
  const deals = save ? [...others, deal] : others;
  storage.setItem(savedDealsKey, JSON.stringify(deals));
  return deals;
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
