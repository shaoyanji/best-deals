"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronDown,
  Globe2,
  Grid2X2,
  Headphones,
  House,
  Laptop,
  Leaf,
  RefreshCw,
  Search,
  Shirt,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Tag,
  X,
  Gamepad2,
} from "lucide-react";
import {
  categories,
  type Category,
  type Deal,
  type Feed,
  type Region,
} from "@/lib/types";
import { filterDeals, type Sort } from "@/lib/filters";
import {
  parseSavedDeals,
  savedAvailability,
  savedDealsKey,
  updateSavedDeal,
  type SavedAvailability,
} from "@/lib/saved-deals";

const icons = [Grid2X2, Laptop, House, Shirt, Gamepad2, Leaf, ShoppingBag];
const money = (deal: Deal) =>
  deal.price === null
    ? null
    : new Intl.NumberFormat(deal.region === "UK" ? "en-GB" : "en-US", {
        style: "currency",
        currency: deal.currency,
        maximumFractionDigits: 2,
      }).format(deal.price);
function elapsed(date: string) {
  const minutes = Math.max(
    1,
    Math.round((Date.now() - Date.parse(date)) / 60_000),
  );
  return minutes < 60
    ? `${minutes}m ago`
    : minutes < 1440
      ? `${Math.floor(minutes / 60)}h ago`
      : `${Math.floor(minutes / 1440)}d ago`;
}

function ProductImage({
  deal,
  className = "",
}: {
  deal: Deal;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={`product-image ${className}`}>
      {deal.image && !broken ? (
        <Image
          src={deal.image}
          alt=""
          width={300}
          height={300}
          unoptimized
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
      ) : (
        <ShoppingBag className="fallback-image" aria-hidden="true" />
      )}
    </div>
  );
}

function DealCard({
  deal,
  availability,
  saved,
  toggle,
  open,
}: {
  deal: Deal;
  availability: SavedAvailability;
  saved: boolean;
  toggle: (d: Deal) => void;
  open: (d: Deal) => void;
}) {
  return (
    <article className="deal-card">
      <div className="card-visual">
        <button
          className="image-button"
          aria-label={`Details: ${deal.title}`}
          onClick={() => open(deal)}
        >
          <ProductImage deal={deal} />
        </button>
        <span
          className={`deal-badge ${!availability && deal.discount ? "discount" : ""}`}
        >
          {availability === "expired"
            ? "Expired"
            : availability === "unlisted"
              ? "Not in latest feed"
              : deal.discount
                ? `${deal.upTo ? "Up to " : ""}${deal.discount}% off`
                : deal.category}
        </span>
        <button
          className={`save-button ${saved ? "is-saved" : ""}`}
          onClick={() => toggle(deal)}
          aria-label={`${saved ? "Unsave" : "Save"} ${deal.title}`}
          aria-pressed={saved}
        >
          <Bookmark size={18} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="card-content">
        <div className="merchant-line">
          <span>{deal.merchant}</span>
          <span>{deal.region}</span>
        </div>
        <h3>
          <button onClick={() => open(deal)}>{deal.title}</button>
        </h3>
        <div className="card-price">
          <strong>{money(deal) ?? "See offer"}</strong>
          <span>
            {availability
              ? deal.price === null
                ? "Saved listing"
                : "Last listed price"
              : deal.discount
                ? "Listed discount"
                : "Source-listed offer"}
          </span>
        </div>
        {availability && (
          <p className="saved-status">
            {availability === "expired"
              ? "This offer has expired. Kept here for reference."
              : "Availability unknown. Check the original listing."}
          </p>
        )}
        <div className="card-bottom">
          <span suppressHydrationWarning>
            {deal.source} <span className="muted-dot">·</span>{" "}
            {elapsed(deal.publishedAt)}
          </span>
          <a
            href={deal.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View ${deal.title} on ${deal.source}`}
          >
            <ArrowUpRight size={20} />
          </a>
        </div>
      </div>
    </article>
  );
}

function DealDialog({
  deal,
  availability,
  close,
  saved,
  toggle,
}: {
  deal: Deal;
  availability: SavedAvailability;
  close: () => void;
  saved: boolean;
  toggle: (deal: Deal) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="deal-dialog"
      onCancel={close}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
      aria-labelledby="deal-title"
    >
      <button
        className="dialog-close icon-button"
        aria-label="Close deal"
        onClick={close}
      >
        <X size={22} />
      </button>
      <ProductImage deal={deal} className="dialog-image" />
      <div className="dialog-content">
        <div className="eyebrow">
          {deal.merchant} <span> / </span> {deal.region} deal
        </div>
        <h2 id="deal-title">{deal.title}</h2>
        {availability && (
          <p className="feed-warning" role="status">
            {availability === "expired"
              ? "Expired offer. This saved listing is kept for reference; its price is no longer current."
              : "Not in the latest feed. This saved listing may have changed or expired; its price was last seen when listed."}
          </p>
        )}
        <div className="dialog-price">
          {money(deal) ?? "See offer at source"}
        </div>
        <p>
          {deal.description ||
            "Visit the original listing for full details and conditions."}
        </p>
        <div className="source-note">
          <Globe2 size={17} />
          <span>
            Found on {deal.source}. Prices and availability can change. Check
            shipping, membership and coupon conditions at the source.
          </span>
        </div>
        <a
          className="primary deal-link"
          href={deal.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {availability ? "Check original listing on" : "View deal on"}{" "}
          {deal.source}
          <ArrowUpRight size={18} />
        </a>
        <button
          className="secondary"
          aria-pressed={saved}
          onClick={() => toggle(deal)}
        >
          <Bookmark size={17} fill={saved ? "currentColor" : "none"} />
          {saved ? "Saved to your finds" : "Save for later"}
        </button>
      </div>
    </dialog>
  );
}

export default function DealsApp({ initialFeed }: { initialFeed: Feed }) {
  const [feed, setFeed] = useState(initialFeed);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("All finds");
  const [region, setRegion] = useState<Region>("all");
  const [sort, setSort] = useState<Sort>("recent");
  const [savedDeals, setSavedDeals] = useState<Deal[]>([]);
  const [savedLoaded, setSavedLoaded] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [now, setNow] = useState(0);
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLElement>(null);
  const visitOnly = useRef(false);

  useEffect(() => {
    function syncSaved() {
      try {
        if (!visitOnly.current)
          setSavedDeals(parseSavedDeals(localStorage.getItem(savedDealsKey)));
      } catch {
        // Preserve visit-only saves when storage is unavailable or unreadable.
      }
      setSavedLoaded(true);
      setNow(Date.now());
    }
    function storageChanged(event: StorageEvent) {
      if (
        event.storageArea === localStorage &&
        (event.key === savedDealsKey || event.key === null)
      )
        syncSaved();
    }
    function syncView() {
      setSavedOnly(window.location.hash === "#saved");
    }
    syncSaved();
    syncView();
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    window.addEventListener("storage", storageChanged);
    window.addEventListener("focus", syncSaved);
    window.addEventListener("hashchange", syncView);
    window.addEventListener("popstate", syncView);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("storage", storageChanged);
      window.removeEventListener("focus", syncSaved);
      window.removeEventListener("hashchange", syncView);
      window.removeEventListener("popstate", syncView);
    };
  }, []);
  useEffect(() => {
    setPage(1);
  }, [query, category, region, sort, savedOnly]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  function toggle(deal: Deal) {
    const exists = savedDeals.some((d) => d.id === deal.id);
    const next = exists
      ? savedDeals.filter((d) => d.id !== deal.id)
      : [...savedDeals, deal];
    try {
      if (visitOnly.current) throw new Error("Visit-only saves");
      setSavedDeals(updateSavedDeal(localStorage, deal, !exists));
      setNotice(
        exists
          ? "Removed from saved finds"
          : "Saved. A good find worth keeping.",
      );
    } catch {
      visitOnly.current = true;
      setSavedDeals(next);
      setNotice(
        exists
          ? "Removed for this visit. Browser storage is unavailable."
          : "Saved for this visit. Browser storage is unavailable.",
      );
    }
  }
  function navigateSaved(saved: boolean) {
    setSavedOnly(saved);
    window.history.pushState(null, "", saved ? "#saved" : "#finds");
  }
  async function refresh() {
    setRefreshing(true);
    try {
      const response = await fetch("/api/deals");
      if (!response.ok) throw new Error("Refresh failed");
      const next = (await response.json()) as Feed;
      setFeed(next);
      setNotice(
        next.stale
          ? "Some sources are unavailable. Showing the latest we have."
          : "You’re all caught up. Feeds refresh every 15 minutes.",
      );
    } catch {
      setNotice("Couldn’t refresh. Your current finds are still here.");
    } finally {
      setRefreshing(false);
    }
  }
  const allDeals = savedOnly
    ? savedDeals.map((d) => feed.deals.find((f) => f.id === d.id) ?? d)
    : feed.deals;
  const filtered = filterDeals(allDeals, query, category, region, sort);
  const featured =
    feed.deals.find((d) => d.image && d.category === "Tech") ??
    feed.deals.find((d) => d.image);
  const savedIds = savedDeals.map((d) => d.id);
  const clear = () => {
    setQuery("");
    setCategory("All finds");
    setRegion("all");
    setSort("recent");
  };

  return (
    <>
      <a className="skip-link" href="#finds">
        Skip to deals
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="/" aria-label="bestdeals home">
            bestdeals<span className="brand-mark">✳</span>
          </a>
          <nav aria-label="Main navigation">
            <button
              className={!savedOnly ? "nav-active" : ""}
              onClick={() => {
                navigateSaved(false);
                clear();
              }}
            >
              Discover
            </button>
            <button
              className={savedOnly ? "nav-active" : ""}
              onClick={() => {
                navigateSaved(true);
                clear();
                resultsRef.current?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <Bookmark size={16} />
              Saved finds{" "}
              <span className="saved-count">
                {savedLoaded ? savedDeals.length : 0}
              </span>
            </button>
          </nav>
          <div className="header-right">
            <span className="little-label">Less hunting. More finding.</span>
            <a className="header-cta" href="#finds">
              Find your next deal <ArrowDown size={15} />
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="hero wrap" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="live-dot" />
              THE INTERNET’S GOOD FINDS, TOGETHER
            </div>
            <h1 id="hero-title">
              Good finds.
              <br />
              <span>Great prices.</span>
              <svg
                viewBox="0 0 264 15"
                className="headline-underline"
                aria-hidden="true"
              >
                <path d="M3 10 Q130 -3 260 8 M70 13 Q160 5 246 13" />
              </svg>
            </h1>
            <p>
              Skip the endless tabs. Discover worthwhile deals
              <br className="desktop-break" /> from across the web, all in one
              happy place.
            </p>
            <a className="hero-link" href="#finds">
              Meet your next good find <ArrowRight size={18} />
            </a>
            <div className="source-pills">
              <span>FOUND ACROSS</span>
              <b>Slickdeals</b>
              <b>HotUKDeals</b>
              <b>DealNews</b>
            </div>
          </div>
          <div className="hero-art" aria-label="A find from the latest feed">
            <div className="art-grid" />
            <div className="orbit-label">
              <Sparkles size={15} /> Less scrolling, more saving
            </div>
            {featured ? (
              <button
                className="feature-card"
                onClick={() => setActiveDeal(featured)}
              >
                <div className="feature-top">
                  <span>THE GOOD FIND EDIT</span>
                  <ArrowUpRight size={18} />
                </div>
                <ProductImage deal={featured} />
                <div className="feature-info">
                  <span>{featured.merchant}</span>
                  <h2>{featured.title}</h2>
                  <strong>{money(featured) ?? "Explore this offer"}</strong>
                </div>
              </button>
            ) : (
              <div className="feature-card placeholder-feature">
                <Headphones size={110} />
                <h2>
                  Your next good find
                  <br />
                  is on its way.
                </h2>
              </div>
            )}
            <div className="round-stamp">
              <Tag size={21} />
              <span>
                GOOD DEAL.
                <br />
                GREAT FEELING.
              </span>
            </div>
            <span className="art-spark spark-one">✳</span>
            <span className="art-spark spark-two">✳</span>
          </div>
        </section>

        <section
          className="browse-section wrap"
          id="finds"
          ref={resultsRef}
          aria-labelledby="results-title"
        >
          <div className="search-row">
            <div className="search-box">
              <Search size={21} />
              <input
                ref={searchRef}
                aria-label="Search deals"
                placeholder="A new pair of headphones? A better coffee maker?"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button
                  className="icon-button"
                  onClick={() => {
                    setQuery("");
                    searchRef.current?.focus();
                  }}
                  aria-label="Clear search"
                >
                  <X size={18} />
                </button>
              )}
              <span className="search-hint">Find something good</span>
            </div>
            <div className="region-select">
              <Globe2 size={18} />
              <select
                aria-label="Deal region"
                value={region}
                onChange={(e) => {
                  setRegion(e.target.value as Region);
                  if (e.target.value === "all" && sort === "price")
                    setSort("recent");
                }}
              >
                <option value="all">US + UK deals</option>
                <option value="US">United States · $</option>
                <option value="UK">United Kingdom · £</option>
              </select>
              <ChevronDown size={15} />
            </div>
          </div>
          <div className="categories" aria-label="Deal categories">
            {categories.map((item, i) => {
              const Icon = icons[i];
              return (
                <button
                  key={item}
                  className={category === item ? "selected" : ""}
                  aria-pressed={category === item}
                  onClick={() => setCategory(item)}
                >
                  <Icon size={17} />
                  {item}
                </button>
              );
            })}
          </div>

          <div className="results-toolbar">
            <div>
              <div className="section-kicker">
                A LITTLE DISCOVERY GOES A LONG WAY
              </div>
              <h2 id="results-title">
                {savedOnly
                  ? "Your saved finds"
                  : query
                    ? "Your search results"
                    : category !== "All finds"
                      ? `${category} finds`
                      : "Fresh finds, worth a look."}
                <span>{filtered.length}</span>
              </h2>
            </div>
            <div className="toolbar-right">
              <button
                className="refresh-button"
                onClick={refresh}
                disabled={refreshing}
                aria-label="Refresh deals"
              >
                <RefreshCw size={15} className={refreshing ? "spinning" : ""} />
                <span>{refreshing ? "Refreshing" : "Refresh"}</span>
              </button>
              <label className="sort-select">
                <SlidersHorizontal size={15} />
                <select
                  aria-label="Sort deals"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                >
                  <option value="recent">Newest first</option>
                  <option value="discount">Biggest % off</option>
                  {region !== "all" && (
                    <option value="price">Price: low to high</option>
                  )}
                </select>
                <ChevronDown size={14} />
              </label>
            </div>
          </div>
          {feed.stale && !savedOnly && (
            <div className="feed-warning">
              {feed.unavailableSources.join(", ")}{" "}
              {feed.unavailableSources.length === 1 ? "is" : "are"} temporarily
              unavailable. Some listings may be from our last update.
            </div>
          )}
          {savedOnly && (
            <p className="saved-explainer">
              A little shortlist for later. Saved on this browser, no account
              needed. Listings stay saved even after leaving the latest feed.
            </p>
          )}
          <div aria-live="polite" className="sr-only">
            {filtered.length} deals found
          </div>
          {filtered.length ? (
            <div className="deals-grid">
              {filtered.slice(0, page * 16).map((deal) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  availability={
                    savedOnly ? savedAvailability(deal, feed.deals, now) : null
                  }
                  saved={savedIds.includes(deal.id)}
                  toggle={toggle}
                  open={setActiveDeal}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              {savedOnly ? <Bookmark size={34} /> : <Search size={34} />}
              <h3>
                {savedOnly && !savedDeals.length
                  ? "Keep the good ones close."
                  : "No finds here. Yet."}
              </h3>
              <p>
                {savedOnly && !savedDeals.length
                  ? "Tap the bookmark on any deal to start your little shortlist."
                  : !feed.deals.length && !savedOnly
                    ? "Our sources are taking a moment. Try refreshing in a little while."
                    : "Try a different search or give those filters a little breathing room."}
              </p>
              <button
                className="primary"
                onClick={() => {
                  clear();
                  if (!feed.deals.length && !savedOnly) void refresh();
                  else navigateSaved(false);
                }}
              >
                {!feed.deals.length && !savedOnly
                  ? "Try refreshing"
                  : "Explore all finds"}
                <ArrowRight size={17} />
              </button>
            </div>
          )}
          {filtered.length > page * 16 && (
            <div className="load-more">
              <button
                className="secondary"
                onClick={() => setPage((p) => p + 1)}
              >
                More good finds <ArrowDown size={16} />
              </button>
              <span>
                Showing {Math.min(page * 16, filtered.length)} of{" "}
                {filtered.length} finds
              </span>
            </div>
          )}
          <div className="feed-footer">
            <span>
              <span className="live-dot" />
              {feed.stale ? "Latest available feeds" : "Fresh from the source"}
            </span>
            <span>
              Checked{" "}
              <time dateTime={feed.updatedAt} suppressHydrationWarning>
                {new Date(feed.updatedAt).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: "UTC",
                })}{" "}
                UTC
              </time>{" "}
              · refreshes every 15 min
            </span>
          </div>
        </section>
        <section className="promise-band wrap">
          <div className="promise-icon">
            <Sparkles size={29} />
          </div>
          <div>
            <h2>Less noise. More “oh, nice.”</h2>
            <p>Real listings. Original sources. No made-up savings.</p>
          </div>
          <span className="promise-small">
            A small corner of a very big internet.
          </span>
        </section>
      </main>
      <footer className="site-footer wrap">
        <div className="footer-top">
          <a className="brand" href="/">
            bestdeals<span>✳</span>
          </a>
          <p>Good finds are better shared.</p>
          <a href="#finds">
            Back to the finds <ArrowUpRight size={15} />
          </a>
        </div>
        <div className="footer-bottom">
          <p>
            Curated feeds, not the whole internet. Offers link to Slickdeals,
            HotUKDeals and DealNews; source sites may use affiliate links.
            Prices, shipping and availability can change.
          </p>
          <span>Made for the find.</span>
        </div>
      </footer>
      {activeDeal && (
        <DealDialog
          deal={feed.deals.find((d) => d.id === activeDeal.id) ?? activeDeal}
          availability={savedAvailability(
            feed.deals.find((d) => d.id === activeDeal.id) ?? activeDeal,
            feed.deals,
            now,
          )}
          saved={savedIds.includes(activeDeal.id)}
          toggle={toggle}
          close={() => setActiveDeal(null)}
        />
      )}
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          {notice}
        </div>
      )}
    </>
  );
}
