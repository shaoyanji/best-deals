import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import he from "he";
import { currencies, type Category, type Deal } from "./types";

export const sources = [
  {
    name: "Slickdeals",
    region: "US",
    url: "https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1",
  },
  {
    name: "HotUKDeals",
    region: "UK",
    url: "https://www.hotukdeals.com/rss/hot",
  },
  { name: "DealNews", region: "US", url: "https://www.dealnews.com/?rss=1" },
  {
    name: "Schnäppchenfuchs",
    region: "DE",
    url: "https://schnaeppchenfuchs.com/rss",
  },
  { name: "DealDoktor", region: "DE", url: "https://www.dealdoktor.de/feed/" },
  {
    name: "DealDoktor Community",
    region: "DE",
    url: "https://www.dealdoktor.de/user-deals/feed/",
  },
] as const;
type Source = (typeof sources)[number];

export function plain(value: unknown): string {
  return he
    .decode(String(value ?? "").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function safeUrl(value: unknown): string | null {
  try {
    const url = new URL(he.decode(String(value)));
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function isInStore(title: string, description: string): boolean {
  return (
    /\[lokal\]|\(lokal\)/i.test(title) ||
    /(?<!nicht )\bnur (?:vor Ort|in (?:der|den|teilnehmenden) Filialen?)\b/i.test(
      `${title} ${description}`,
    ) ||
    /(?:^|[.!?]\s+)gültig in (?:allen|teilnehmenden) Filialen\b|\bin einigen (?:[\p{L}\p{N}-]+-)?Einrichtungshäusern\b/iu.test(
      description,
    )
  );
}

export function categorize(text: string): Category {
  // Household steam cleaners are not Steam games or gaming hardware.
  if (/\b(vacuums?|carpet cleaners?|steam (?:cleaners?|mops?))\b/i.test(text))
    return "Home & living";
  if (
    /\b(playstation|xbox|nintendo|gaming|dualsense|video game|steam|lego)\b/i.test(
      text,
    )
  )
    return "Gaming";
  if (
    /\b(laptop|computer|monitor|ssd|tv|oled|headphones?|earbuds?|iphone|ipad|tablet|usb|anker|samsung|macbook|speaker|camera|pixel|charger|smartwatch|router)\b/i.test(
      text,
    )
  )
    return "Tech";
  if (
    /\b(shoe|sneaker|clothing|jacket|shirt|adidas|nike|jeans|hoodie|dress|fashion|boot|coat|socks)\b/i.test(
      text,
    )
  )
    return "Style";
  if (
    /\b(outdoor|camping|tent|bike|bicycle|garden|hiking|fitness|water bottle|sports|luggage)\b/i.test(
      text,
    )
  )
    return "Outdoors";
  if (
    /\b(home|furniture|kitchen|coffee|vacuum|sofa|desk|chair|mattress|cookware|pillow|ninja|air fryer|pan|bedding|lamp)\b/i.test(
      text,
    )
  )
    return "Home & living";
  return "Everyday";
}

export function parseFeed(
  xml: string,
  source: Source,
  now = Date.now(),
): Deal[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    processEntities: true,
  });
  const parsed = parser.parse(xml);
  const raw = parsed?.rss?.channel?.item;
  if (!raw) throw new Error(`No items in ${source.name}`);
  const items = Array.isArray(raw) ? raw : [raw];
  return items.flatMap((item): Deal[] => {
    const title = plain(item.title).replace(/^\d+°\s*-\s*/, "");
    const url = safeUrl(item.link);
    const published = Date.parse(item.pubDate);
    const expires = Date.parse(item["dealnews:expires"]);
    if (
      !title ||
      !url ||
      !Number.isFinite(published) ||
      published < now - 72 * 3600_000 ||
      (Number.isFinite(expires) && expires <= now)
    )
      return [];
    const html = String(item["content:encoded"] ?? item.description ?? "");
    const description = plain(item.description);
    const image = safeUrl(
      item["media:content"]?.["@_url"] ??
        item["media:thumbnail"]?.["@_url"] ??
        html.match(/<img[^>]+src=["']([^"']+)/i)?.[1],
    );
    const merchant = plain(
      item["pepper:merchant"]?.["@_name"] ??
        item["dealnews:retailer"] ??
        html.match(
          /data-(?:product-exitWebsite|store-slug)=["']([^"']+)/,
        )?.[1] ??
        description.match(/^([\w .!'&-]{2,32}) has\b/)?.[1] ??
        source.name,
    );
    const currency = currencies[source.region];
    // Prose mixes prices, discounts, trade-ins and shipping. Only use a
    // dedicated structured price field; otherwise send readers to the source.
    const ukPrice = String(item["pepper:merchant"]?.["@_price"] ?? "").match(
      /^£\s*([\d,]+(?:\.\d{1,2})?)$/,
    );
    const structuredPrice =
      source.name === "HotUKDeals"
        ? ukPrice
          ? Number(ukPrice[1].replace(/,/g, ""))
          : NaN
        : source.name === "DealNews"
          ? Number(item["dealnews:price"])
          : NaN;
    const parsedPrice =
      Number.isFinite(structuredPrice) && structuredPrice > 0
        ? structuredPrice
        : null;
    const discountMatch = title.match(
      /(up to\s+)?(\d{1,2})%\s*(?:off|discount)/i,
    );
    return [
      {
        id: createHash("sha256")
          .update(`${source.name}:${item.guid?.["#text"] ?? item.guid ?? url}`)
          .digest("hex")
          .slice(0, 24),
        title,
        description: description.slice(0, 900),
        url,
        image,
        source: source.name,
        merchant,
        region: source.region,
        currency,
        ...(source.region === "DE" && isInStore(title, description)
          ? { inStore: true }
          : {}),
        price: parsedPrice !== null && parsedPrice > 0 ? parsedPrice : null,
        discount: discountMatch ? Number(discountMatch[2]) : null,
        upTo: Boolean(discountMatch?.[1]),
        category: categorize(
          `${title} ${plain(item["dealnews:category"] ?? item.category)}`,
        ),
        publishedAt: new Date(published).toISOString(),
        expiresAt: Number.isFinite(expires)
          ? new Date(expires).toISOString()
          : null,
      },
    ];
  });
}
