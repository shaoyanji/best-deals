# best-deals

A small, responsive deal-discovery app built with Next.js, Vercel and Supabase. It reads public RSS feeds from Slickdeals, HotUKDeals and DealNews. It does not claim to cover every online deal or independently verify discounts.

## Local development

Use Node.js 24 (`nvm use`), then:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

The app works without credentials using a process-local feed cache. To persist the cache across serverless instances, create a **separate** Supabase project, apply `supabase/migrations/202611250001_feed_cache.sql`, and set `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. The key must be a server-side secret or legacy service-role key, never a publishable/anonymous key. No existing project or user data is needed.

## Checks

```sh
npm test
npm run typecheck
npm run build
```

## Deploy to Vercel

Import this GitHub repository, select Next.js, use Node.js 24, and add the two environment variables above to production and preview. Vercel runs `npm run build` automatically. No paid services or cron jobs are required. Request-time refresh runs at most once per 15 minutes per healthy cache. Concurrent requests in one instance share one refresh. Across instances, occasional concurrent refreshes are harmless last-write-wins updates.

## Product behavior

- Search titles, merchants, categories and sources; filter by category and US/UK region.
- Sort by newest or explicit listed percentage discount; price sorting only appears for a single currency.
- Bookmark full deal records in this browser's local storage. There is no account, cross-device sync, or tracking.
- Open a detail dialog or follow the original source listing, which contains retailer links and deal conditions.
- Exclude listings older than 72 hours and explicitly expired listings. Feed listings may still sell out or expire without an RSS update.
- Refresh all three sources in parallel with timeouts. If a source fails, retain its still-recent cached listings and show a warning. Never substitute fabricated offers.
- Render source content as plain text. HTTPS-only external links and images; no source HTML is injected.
- Supabase stores only the shared feed cache. Row-level security and revoked client grants keep the table server-only. Keys never enter the browser bundle.

## Price and source limitations

RSS is a discovery feed, not a retailer inventory API. Numeric prices come only from dedicated structured feed fields (HotUKDeals and DealNews), may be conditional, and are not checkout quotes. Slickdeals provides no structured price, so its cards say “See offer” rather than guessing from prose that mixes discounts, shipping and prices. Percentage badges are only shown when explicitly stated; “up to” is preserved. All source names and original links remain attached. Some source sites use affiliate links; this app adds no affiliate IDs. Saved records may outlive an offer and are labeled accordingly.
