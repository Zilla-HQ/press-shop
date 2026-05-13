# Press — Custom print, on demand

A sister brand to **Anchor** (curated dad caps), under the **Bolthouse** parent. Press lets any customer upload their own design and get it printed on a Printful catalog product: t-shirts, hoodies, embroidered caps, totes.

- Anchor: 3 curated caps at a fixed price → gift-buyers, identity-driven, Father's Day-coded.
- Press: bring your own design → designers, gift-makers, founders making merch.

Same Shopify store (bolthouse), same Printful API key, same Neon order persistence, same `orders/create` webhook handler. Just a different storefront pointed at the shared infrastructure.

---

## What's in the repo

```
press-shop/
├── platform/
│   └── web/                              ← Next.js root (Vercel Root Directory)
│       ├── pages/
│       │   ├── index.tsx                 Home — brand hero + product catalog grid
│       │   ├── products/[id].tsx         Product detail — upload + preview + buy
│       │   ├── api/
│       │   │   ├── preview.ts            Upload to Shopify CDN, generate Printful mockup
│       │   │   ├── customize.ts          Create Shopify product + return checkout URL
│       │   │   └── webhooks/shopify/order-created.ts
│       │   │                              Same handler as Anchor; routes Printful orders
│       │   └── policies/                 Shipping, returns, privacy, terms
│       ├── lib/
│       │   ├── press-catalog.ts          Customer-facing catalog (4 starter products)
│       │   ├── shopify-admin.ts          Shared with Anchor
│       │   ├── printful-api.ts           Shared with Anchor
│       │   ├── orders-db.ts              Shared with Anchor (Neon)
│       │   └── app-url.ts                Shared with Anchor
│       ├── components/
│       │   └── PolicyPage.tsx
│       └── styles/globals.css
├── migrations/
│   └── 001_brand_orders.sql              Same schema as Anchor's apparel template
└── .env.example
```

---

## Customer flow

1. Land on `/` → see a hero + 4 product cards (T-shirt, hoodie, cap, tote)
2. Click a product → `/products/<id>`
3. Upload a PNG → click **Preview** → see a real Printful-rendered mockup on the blank
4. Click **Buy** → one-off Shopify product gets created with the design as primary image, customer is redirected to Shopify cart, pays, the orders/create webhook fires and submits the order to Printful for fulfillment

---

## Catalog (initial)

| SKU | Product | Retail | Printful blank | Placement |
|---|---|---|---|---|
| `tee` | Heavyweight T-Shirt | $32 | Bella+Canvas 3001 (#71) | Front DTG |
| `hoodie` | Heavyweight Hoodie | $58 | Gildan 18500 (#146) | Front DTG |
| `cap` | Embroidered Dad Cap | $32 | Yupoong 6245CM (#206) | Embroidery front |
| `tote` | Canvas Tote Bag | $28 | LB8861 (#84) | Front print |

Adding a new product is a single object in `lib/press-catalog.ts`.

---

## Deploy

1. Vercel → New Project → import `Zilla-HQ/press-shop`
2. **Root Directory: `platform/web`** (critical)
3. Paste the env vars from `.env.example` (use the **same values** as the Anchor project — same Shopify store, same Printful, same Neon DB)
4. (Optional) Add a Vercel Blob store for design hosting fallback
5. Register the `orders/create` webhook in bolthouse Shopify pointing at the new deployment's `/api/webhooks/shopify/order-created` URL (or leave it on the Anchor project's URL — the handler routes both stores' orders through the same Neon DB)

---

## Buy a domain

Pick whatever fits — `press.shop` would be ideal if available. `getpress.com` or `pressmade.com` work too. Same setup pattern as Anchor: buy via Vercel, point at the project, the middleware will (when wired) serve `/` directly.

---

## Why this is fast to build

Every backend piece was already wired for Anchor:
- Shopify Admin API integration: `createBrandedProduct`, `setProductMetafields`, OAuth client_credentials
- Printful: file upload, mockup generation, order submission with thread_colors auto-derivation
- Order webhook: HMAC verification, metafield lookup, Printful submit, Neon persist
- Neon `brand_orders` table and `getBrandMetrics` aggregation

Press just adds:
- A different storefront UX (catalog + uploader vs. curated brand page)
- Two new API endpoints (`/api/preview`, `/api/customize`) that wire the customer-side upload flow into the existing infrastructure

Estimated 1–2 days from this scaffold to a fully shippable site (real photography, copy polish, email flows, domain).
