import test from "node:test";
import assert from "node:assert/strict";
import { parseFeed, sources } from "../lib/parse-feed";
import { filterDeals } from "../lib/filters";

const now = Date.parse("2026-11-25T12:00:00Z");
function rss(item: string) {
  return `<rss xmlns:pepper="http://www.pepper.com/rss" xmlns:media="http://search.yahoo.com/mrss/" xmlns:dealnews="https://www.dealnews.com/ns/rss/1.0.htm"><channel><item><guid>123</guid><link>https://example.com/deal</link><pubDate>Wed, 25 Nov 2026 11:00:00 GMT</pubDate>${item}</item></channel></rss>`;
}

test("UK structured price, merchant, image, category, entities and heat prefix are normalized", () => {
  const [deal] = parseFeed(
    rss(
      '<title>110° - Sony headphones &amp; case</title><pepper:merchant name="Amazon" price="£19.99"/><media:content url="https://example.com/image.jpg"/>',
    ),
    sources[1],
    now,
  );
  assert.equal(deal.title, "Sony headphones & case");
  assert.equal(deal.price, 19.99);
  assert.equal(deal.currency, "GBP");
  assert.equal(deal.merchant, "Amazon");
  assert.equal(deal.image, "https://example.com/image.jpg");
});

test("keeps up-to discounts distinct and does not invent a promotion price", () => {
  const [deal] = parseFeed(
    rss("<title>Furniture sale: Up to 80% off</title>"),
    sources[2],
    now,
  );
  assert.equal(deal.price, null);
  assert.equal(deal.discount, 80);
  assert.equal(deal.upTo, true);
});

test("uses precise structured prices rather than rounded title amounts", () => {
  const [deal] = parseFeed(
    rss(
      "<title>Outdoor lights for $44</title><dealnews:price>44.18</dealnews:price>",
    ),
    sources[2],
    now,
  );
  assert.equal(deal.price, 44.18);
  const [offer] = parseFeed(
    rss("<title>Save $20 on your next order</title>"),
    sources[0],
    now,
  );
  assert.equal(offer.price, null);
});

test("omits expired and old offers, and unsafe external URLs", () => {
  assert.equal(
    parseFeed(
      rss(
        "<title>Offer</title><dealnews:expires>2026-11-24T12:00:00Z</dealnews:expires>",
      ),
      sources[2],
      now,
    ).length,
    0,
  );
  assert.equal(
    parseFeed(
      rss("<title>Offer</title>").replace("25 Nov", "20 Nov"),
      sources[0],
      now,
    ).length,
    0,
  );
  assert.equal(
    parseFeed(
      rss("<title>Offer</title>").replace(
        "https://example.com/deal",
        "javascript:alert(1)",
      ),
      sources[0],
      now,
    ).length,
    0,
  );
});

test("strips source markup and gives stable source-specific IDs", () => {
  const xml = rss(
    "<title>Offer $20</title><description><![CDATA[<script>not executable</script><b>A deal</b>]]></description>",
  );
  const [a] = parseFeed(xml, sources[0], now);
  const [b] = parseFeed(xml, sources[0], now);
  const [c] = parseFeed(xml, sources[2], now);
  assert.equal(a.id, b.id);
  assert.notEqual(a.id, c.id);
  assert.ok(!a.description.includes("<"));
});

test("filters combine region, category, all search terms and saved IDs", () => {
  const [uk] = parseFeed(
    rss(
      '<title>Gaming controller</title><pepper:merchant name="Amazon" price="£19.99"/>',
    ),
    sources[1],
    now,
  );
  const [us] = parseFeed(
    rss("<title>Gaming controller $40</title>"),
    sources[0],
    now,
  );
  assert.equal(
    filterDeals([uk, us], "gaming amazon", "Gaming", "UK", "recent").length,
    1,
  );
  assert.equal(
    filterDeals([uk, us], "", "All finds", "all", "recent", [us.id])[0].region,
    "US",
  );
  assert.equal(
    filterDeals([uk, us], "nonexistent", "All finds", "all", "recent").length,
    0,
  );
});

test("unknown prices and discounts sort after explicit values", () => {
  const [unknown] = parseFeed(
    rss("<title>Furniture sale</title>"),
    sources[2],
    now,
  );
  const [priced] = parseFeed(
    rss("<title>Furniture $25: 30% off</title>"),
    sources[0],
    now,
  );
  assert.equal(
    filterDeals([unknown, priced], "", "All finds", "all", "price")[0].price,
    25,
  );
  assert.equal(
    filterDeals([unknown, priced], "", "All finds", "all", "discount")[0]
      .discount,
    30,
  );
});
