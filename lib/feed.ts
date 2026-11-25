import "server-only";
import { createClient } from "@supabase/supabase-js";
import { parseFeed, sources } from "./parse-feed";
import type { Deal, Feed } from "./types";

const TTL = 15 * 60_000;
let cached: Feed | null = null;
let pending: Promise<Feed> | null = null;

function database() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  return url && key
    ? createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;
}

async function refresh(): Promise<Feed> {
  const db = database();
  // Across serverless cold starts, Supabase is the shared cache.
  let previous: Feed | null = cached;
  if (db) {
    const { data, error } = await db
      .from("feed_cache")
      .select("payload")
      .eq("id", "main")
      .maybeSingle();
    if (!error && data?.payload) {
      previous = data.payload as Feed;
      if (Date.now() - Date.parse(previous.updatedAt) < TTL && !previous.stale)
        return { ...previous, storage: "supabase" };
    }
  }
  const results = await Promise.allSettled(
    sources.map(async (source) => {
      const response = await fetch(source.url, {
        headers: {
          "User-Agent": "BestDeals/1.0 (public RSS reader)",
          Accept: "application/rss+xml, application/xml, text/xml",
        },
        signal: AbortSignal.timeout(12_000),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`${source.name}: ${response.status}`);
      const xml = await response.text();
      if (xml.length > 2_000_000) throw new Error("Feed too large");
      return parseFeed(xml, source);
    }),
  );
  const unavailableSources = sources
    .filter((_, i) => results[i].status === "rejected")
    .map((s) => s.name);
  const live = results.flatMap((r) =>
    r.status === "fulfilled" ? r.value : [],
  );
  const fallback = (previous?.deals ?? []).filter(
    (d) =>
      unavailableSources.includes(d.source) &&
      Date.parse(d.publishedAt) > Date.now() - 72 * 3600_000 &&
      (!d.expiresAt || Date.parse(d.expiresAt) > Date.now()),
  );
  const deals: Deal[] = [
    ...new Map([...live, ...fallback].map((deal) => [deal.id, deal])).values(),
  ].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  const feed: Feed = {
    deals,
    updatedAt: live.length
      ? new Date().toISOString()
      : (previous?.updatedAt ?? new Date().toISOString()),
    stale: unavailableSources.length > 0,
    unavailableSources,
    storage: db ? "supabase" : "memory",
  };
  if (db && live.length) {
    const { error } = await db.from("feed_cache").upsert({
      id: "main",
      payload: feed,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.error("Supabase cache write failed:", error.code);
      feed.storage = "memory";
    }
  }
  return feed;
}

export async function getDealFeed(): Promise<Feed> {
  if (cached && Date.now() - Date.parse(cached.updatedAt) < TTL) return cached;
  if (!pending)
    pending = refresh()
      .then((feed) => {
        cached = feed;
        return feed;
      })
      .finally(() => {
        pending = null;
      });
  return pending;
}
