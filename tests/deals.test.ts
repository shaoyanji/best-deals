import test from "node:test";
import assert from "node:assert/strict";
import { categorize, parseFeed, sources } from "../lib/parse-feed";
import { filterDeals } from "../lib/filters";

const now = Date.parse("2026-11-25T12:00:00Z");

test("plural audio products are Tech and steam cleaners are household finds", () => {
  assert.equal(categorize("Beats Solo 4 On-Ear Wireless Headphones"), "Tech");
  assert.equal(
    categorize("Refurb Sony WH-1000XM6 Noise Canceling Headphones"),
    "Tech",
  );
  assert.equal(categorize("Wireless earbuds"), "Tech");
  assert.equal(
    categorize("Dreame N20 Steam Carpet Cleaner Machine"),
    "Home & living",
  );
  assert.equal(categorize("Steam mop"), "Home & living");
  assert.equal(categorize("Steam Deck"), "Gaming");
  assert.equal(categorize("PC game on Steam"), "Gaming");
});

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

test("German editorial feeds keep source links, images and EUR without guessing prices", () => {
  const [fuchs] = parseFeed(
    rss(
      '<title>Degusta Box Black Friday: 2 Boxen für 17€</title><category domain="https://schnaeppchenfuchs.com/kategorien/essen-und-trinken">Essen &amp; Trinken</category><media:content url="https://img-01.schnaeppchenfuchs.com/degusta.png?w=300&amp;h=150"/>',
    ).replace(
      "https://example.com/deal",
      "https://schnaeppchenfuchs.com/angebote/degusta-box-black-friday",
    ),
    sources[3],
    now,
  );
  const [doktor] = parseFeed(
    rss(
      '<title>Nintendo Switch 2 für 49€ + Tarif für 22,49€ + 50€ Wechselbonus</title><content:encoded><![CDATA[<img src="https://www.dealdoktor.de/app/uploads/switch.png">]]></content:encoded>',
    ),
    sources[4],
    now,
  );
  assert.equal(fuchs.source, "Schnäppchenfuchs");
  assert.equal(
    fuchs.url,
    "https://schnaeppchenfuchs.com/angebote/degusta-box-black-friday",
  );
  assert.equal(
    fuchs.image,
    "https://img-01.schnaeppchenfuchs.com/degusta.png?w=300&h=150",
  );
  assert.equal(doktor.source, "DealDoktor");
  assert.equal(
    doktor.image,
    "https://www.dealdoktor.de/app/uploads/switch.png",
  );
  for (const deal of [fuchs, doktor]) {
    assert.equal(deal.region, "DE");
    assert.equal(deal.currency, "EUR");
    assert.equal(deal.price, null);
    assert.equal(deal.inStore, undefined);
  }
  const [us] = parseFeed(rss("<title>US offer</title>"), sources[0], now);
  assert.deepEqual(
    filterDeals([fuchs, us, doktor], "", "All finds", "DE", "recent"),
    [fuchs, doktor],
  );
});

test("German community deals mark explicit store availability, not ambiguous store mentions", () => {
  const source = sources[5];
  for (const description of [
    "Gültig in allen Filialen. Coupon mehrfach einlösbar.",
    "Bald ist Nikolaus: In einigen IKEA-Einrichtungshäusern dürfen eure Kinder ihren Stiefel befüllen lassen.",
    "Das Angebot gilt nur in der Filiale.",
  ]) {
    const [deal] = parseFeed(
      rss(
        `<title>Community offer</title><description><![CDATA[<p>${description}</p>]]></description>`,
      ),
      source,
      now,
    );
    assert.equal(deal.source, "DealDoktor Community");
    assert.equal(deal.inStore, true);
  }
  const [local] = parseFeed(
    rss("<title>[Lokal] Netto-MD: Rabatt kleben und sparen</title>"),
    source,
    now,
  );
  assert.equal(local.inStore, true);
  const [unmarked] = parseFeed(
    rss(
      "<title>Online-Angebot</title><description>Nicht gültig in allen Filialen. Nicht nur vor Ort erhältlich.</description>",
    ),
    source,
    now,
  );
  assert.equal(unmarked.inStore, undefined);
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

test("dollar savings and trade-in credits are not purchase prices", () => {
  const title =
    "<title>Samsung Galaxy Phone Black Friday Deals: Up to $800 off w/ trade-in + free shipping</title>";
  assert.equal(parseFeed(rss(title), sources[2], now)[0].price, null);
  assert.equal(parseFeed(rss(title), sources[0], now)[0].price, null);
  assert.equal(
    parseFeed(rss("<title>Headphones $20 off</title>"), sources[0], now)[0]
      .price,
    null,
  );
});

test("Slickdeals prose never becomes a numeric purchase-price quote", () => {
  const [ipad] = parseFeed(
    rss(
      "<title>Apple iPad Mini $600</title><description>Costco has it for $599.99 ($100 off).</description>",
    ),
    sources[0],
    now,
  );
  const [ring] = parseFeed(
    rss(
      "<title>Ring Indoor Cam $20</title><description>Listed for $24.99, then $19.99 after a $5 checkout discount.</description>",
    ),
    sources[0],
    now,
  );
  assert.equal(ipad.price, null);
  assert.equal(ring.price, null);
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
    rss(
      "<title>Furniture $25: 30% off</title><dealnews:price>25</dealnews:price>",
    ),
    sources[2],
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

test("equal and missing sort values use newest first across source batches", () => {
  const [base] = parseFeed(
    rss("<title>Furniture sale</title>"),
    sources[2],
    now,
  );
  const older = { ...base, id: "older", publishedAt: "2026-11-25T10:00:00Z" };
  const newer = { ...base, id: "newer", publishedAt: "2026-11-25T11:00:00Z" };
  for (const sort of ["price", "discount"] as const) {
    assert.deepEqual(
      filterDeals([older, newer], "", "All finds", "US", sort).map((d) => d.id),
      ["newer", "older"],
    );
    assert.deepEqual(
      filterDeals(
        [
          { ...older, price: 25, discount: 20 },
          { ...newer, price: 25, discount: 20 },
        ],
        "",
        "All finds",
        "US",
        sort,
      ).map((d) => d.id),
      ["newer", "older"],
    );
  }
});
