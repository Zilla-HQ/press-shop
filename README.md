# Press — Custom print, on demand

Customer-facing print-on-demand storefront at **[pressprint.xyz](https://pressprint.xyz)**. Upload a design, pick a blank (shirt, hoodie, cap, tote, mug, tumbler, poster, sticker), get it printed and shipped in 7–11 days.

Sister brand to **Anchor** ([anchorhats.com](https://anchorhats.com), [Zilla-HQ/shopify-template-apparel](https://github.com/Zilla-HQ/shopify-template-apparel)), both under the **Bolthouse** parent company. They share Shopify (single operator store), Printful (single account), Neon (single `brand_orders` table), and the order-fulfillment webhook. They have separate domains, Facebook Pages, Vercel projects, and ad campaigns.

---

## Customer flow

```
1. Land at pressprint.xyz
2. Click a product card → /products/<id>
3. Upload PNG/JPG → click "Preview"
       └─→ /api/preview: server uploads design to Shopify CDN,
           Printful renders mockup, returns persistent URLs
4. See the mockup of your design on the blank
5. Click "Buy · $X" → /api/customize:
       └─→ Creates a one-off Shopify product titled "<Product> — Custom (#<id>)"
       └─→ Attaches mockup as the product image
       └─→ Uploads design to Printful (gets file_id)
       └─→ Sets zilla.printful_* metafields on the product
       └─→ Returns a Shopify cart permalink
6. Redirect to Shopify checkout
7. Customer pays
       └─→ Shopify orders/create webhook fires:
           /api/webhooks/shopify/order-created reads metafields,
           submits the order to Printful's /orders endpoint,
           writes a row to Neon brand_orders
8. Printful prints + ships (5–8 days)
9. Customer receives in 7–11 days total
```

---

## Repo layout

```
press-shop/
├── platform/
│   └── web/                                  ← Next.js root (set this as Vercel Root Directory)
│       ├── pages/
│       │   ├── index.tsx                     Home — brand hero + 8-product catalog grid
│       │   ├── products/[id].tsx             Product detail — upload + preview + buy
│       │   ├── api/
│       │   │   ├── preview.ts                Upload design → Printful mockup → return URLs
│       │   │   ├── customize.ts              Create Shopify product + return cart permalink
│       │   │   └── webhooks/
│       │   │       ├── shopify/order-created.ts   HMAC-verified → Printful + Neon
│       │   │       └── resend/index.ts            Email events from Resend
│       │   └── policies/                     Shipping, returns, privacy, terms
│       ├── lib/
│       │   ├── press-catalog.ts              Customer-facing 8-product catalog
│       │   ├── shopify-admin.ts              Shared with Anchor (admin GraphQL)
│       │   ├── printful-api.ts               Shared with Anchor (catalog + mockups + orders)
│       │   ├── orders-db.ts                  Shared with Anchor (Neon)
│       │   └── app-url.ts                    Resolve canonical base URL
│       ├── components/
│       │   └── PolicyPage.tsx                Shared chrome for /policies/*
│       └── styles/globals.css
├── migrations/
│   └── 001_brand_orders.sql                  Same schema as Anchor (shared DB)
├── docs/
│   ├── SETUP.md                              Step-by-step deployment
│   ├── ARCHITECTURE.md                       How the pieces fit together
│   ├── CATALOG.md                            How to add / edit products
│   └── PRESS_META_ADS.md                     Launch playbook with 3 ad creatives
├── .env.example                              Required env vars
└── README.md                                 This file
```

---

## Current catalog

8 products, all wired with verified Printful catalog IDs:

| Slug | Product | Retail | Wholesale | Margin | Placement |
|---|---|---|---|---|---|
| `tee` | Heavyweight T-Shirt (Bella+Canvas 3001) | $32 | $11 | $21 | front DTG |
| `hoodie` | Heavyweight Hoodie (Gildan 18500) | $58 | $22 | $36 | front DTG |
| `cap` | Embroidered Dad Cap (Yupoong 6245CM) | $32 | $15 | $17 | embroidery_front_large |
| `tote` | Canvas Tote Bag | $28 | $11 | $17 | front |
| `mug` | Ceramic Mug 11oz | $22 | $6 | $16 | wraparound |
| `tumbler` | Stainless Steel Tumbler 20oz | $38 | $25 | $13 | front |
| `poster` | Matte Paper Poster (default 12×16) | $28 | $12 | $16 | default |
| `sticker` | Kiss-Cut Sticker 3″×3″ | $8 | $3 | $5 | default |

Catalog cards use Printful stock product photos as cover images (the blank, no design applied). The detail page renders a real mockup when the customer uploads their design.

See [docs/CATALOG.md](docs/CATALOG.md) to add or modify products.

---

## Status

| Component | Status |
|---|---|
| Domain `pressprint.xyz` purchased | ✓ |
| Vercel project deployed | ✓ |
| 8-product catalog wired with verified Printful IDs | ✓ |
| Storefront UI (home + product detail) | ✓ |
| `/api/preview` (upload + Printful mockup) | ✓ |
| `/api/customize` (create one-off Shopify product + cart URL) | ✓ |
| Shopify `orders/create` webhook handler | ✓ (shared with Anchor) |
| Resend webhook receiver at `/api/webhooks/resend` | ✓ |
| Order persistence in Neon `brand_orders` | ✓ |
| Trust pages (shipping/returns/privacy/terms) | ✓ |
| 3 Meta ad creative briefs | ✓ ([docs/PRESS_META_ADS.md](docs/PRESS_META_ADS.md)) |
| Vercel env vars set | ⬜ user task |
| Resend domain `pressprint.xyz` DNS verified | ⬜ user task |
| End-to-end test purchase | ⬜ user task |
| Meta sales channel installed + Pixel firing | ⬜ user task |
| Ads launched | ⬜ user task |

---

## Three things to set up before ads can run

1. **Vercel env vars** (see [.env.example](.env.example) and [docs/SETUP.md](docs/SETUP.md))
2. **Test purchase end-to-end** — buy any product, refund, verify Printful gets a draft order
3. **Meta Pixel + Conversion API** — install the Meta sales channel in bolthouse Shopify

See [docs/SETUP.md](docs/SETUP.md) for the step-by-step.

---

## Known limitations + planned improvements

| Limitation | Why | Fix path |
|---|---|---|
| No phone case in catalog | Phone cases have 31+ variants split by model (iPhone 11–16); the storefront doesn't have a model picker yet | Add a variant selector to `/products/[id]` |
| Stickers ship at $8 with $5 margin | Low-volume single-sticker pricing | Add sticker-pack variants (3-pack at $18, 10-pack at $40) |
| Posters default to 12×16 only | 16 size variants, no size picker | Add a size selector on the product page |
| No model/lifestyle photography | Catalog uses Printful stock blanks | Hire a photographer or generate AI lifestyle shots; swap `cover_image` URLs |
| No abandoned-cart recovery | Email infra is wired (Resend) but no sequence built | Build via Shopify checkout abandoned-cart event or Resend cron |
| No discount codes wired automatically | Shopify Partner app missing `write_discounts` scope | Manually flip "free shipping over $50" in bolthouse Shopify admin |

---

## Documentation

- [docs/SETUP.md](docs/SETUP.md) — Deploy from clone to live store in ~45 minutes
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — How Shopify, Printful, Vercel, Neon, and Resend connect
- [docs/CATALOG.md](docs/CATALOG.md) — Add a product, swap stock photos, adjust prices
- [docs/PRESS_META_ADS.md](docs/PRESS_META_ADS.md) — Three ad creatives + launch playbook
