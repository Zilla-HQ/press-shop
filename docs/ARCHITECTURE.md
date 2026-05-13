# Architecture

Press is a thin storefront over five services. Each has a clear role; the storefront's job is to compose them into one customer flow.

## The five external services

| Service | Role | Cost |
|---|---|---|
| **Shopify** (bolthouse operator store) | Cart, checkout, payments, order ledger. Hosts one Shopify product per customer order. | $39/mo Basic plan, transaction fees via Shopify Payments |
| **Printful** | Print + fulfillment + shipping. Mockup generator. Catalog of blank products. | Pay-per-order: wholesale price + shipping per item |
| **Vercel** | Hosts the Next.js storefront + serverless API routes. Domain DNS + SSL. | Free tier covers initial launch |
| **Neon** (Postgres) | Order persistence for `/dashboard/<brand>` metrics (shared with Anchor) | Free tier ample for first 10K orders |
| **Resend** | Outbound transactional email + inbound (`hello@pressprint.xyz`). Webhook for delivery events. | Free tier 3K emails/mo |

## How they talk

```
                            CUSTOMER
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
            ▼                   ▼                   ▼
       pressprint.xyz       Shopify              email
       (Vercel)             checkout             (Resend)
            │                   │                   │
            │  /api/preview      │                   │
            │  /api/customize    │                   │
            │  /api/webhooks/*   │                   │
            ▼                   ▼                   ▼
       ┌────────┐          ┌─────────┐         ┌────────┐
       │ Printful │◀──────▶│ Shopify  │────────▶│ Resend │
       │ (files,  │  webhook│ (admin   │ webhook │ events │
       │ mockups, │         │ GraphQL, │         │        │
       │ orders)  │         │ orders)  │         │        │
       └────────┘          └─────────┘         └────────┘
            │                   │
            └────┐         ┌────┘
                 ▼         ▼
              ┌─────────────┐
              │ Neon        │
              │ brand_orders│
              └─────────────┘
```

## The two main flows

### 1. Customer designs + buys (foreground)

```
[Browser]                  [Vercel: /api/preview]            [Shopify CDN]            [Printful]
   │                              │                              │                       │
   │── upload PNG ────────────────▶                              │                       │
   │                              │── staged upload ─────────────▶                       │
   │                              │── fileCreate ────────────────▶                       │
   │                              │◀──── design CDN URL ─────────                        │
   │                              │── /mockup-generator ─────────────────────────────────▶
   │                              │                              │       (poll task)     │
   │                              │◀── mockup S3 URL ────────────────────────────────────│
   │                              │── fetch + staged upload ─────▶                       │
   │                              │◀──── mockup CDN URL ─────────                        │
   │◀── { designUrl, mockupUrl }  │                              │                       │
   │                              │                              │                       │

[Browser]                  [Vercel: /api/customize]
   │                              │
   │── click Buy ─────────────────▶
   │                              │── productCreate (Shopify) ──▶
   │                              │── productVariantsBulkUpdate (price + inv policy)
   │                              │── publishablePublish (all channels)
   │                              │── productCreateMedia (mockup)
   │                              │── Printful /files (design)
   │                              │── metafieldsSet (catalog_variant_id, file_id, placement)
   │                              │
   │◀── { checkoutUrl }           │
   │                              │
[Browser]
   │── redirect to Shopify cart ──▶
```

### 2. Order fulfillment (background)

```
[Customer pays on Shopify]
            │
            ▼
   Shopify fires orders/create webhook
            │
            ▼
[Vercel: /api/webhooks/shopify/order-created]
            │
            ├── verify HMAC against SHOPIFY_DEVAPP_CLIENT_SECRET
            │
            ├── for each line item:
            │     ├── read product metafields (zilla.printful_catalog_variant_id,
            │     │       printful_file_id, printful_placement)
            │     └── build Printful order line item
            │
            ├── submit to Printful POST /orders
            │     (auto-derives thread_colors for embroidery placements)
            │
            └── insert row into Neon brand_orders
                    │
                    ▼
             Dashboard at /dashboard/<brand> shows metrics
```

## Why one Shopify product per customer order

When the customer clicks Buy, we create a fresh Shopify product:
- Title: `<Product> — Custom (#<8-char hex>)`
- Tags: `press:custom:<id>`, `press:<product-slug>`
- One default variant priced at the retail
- Mockup attached as primary image
- `zilla.printful_*` metafields set on the product so the order webhook routes fulfillment

**Why not one shared "Custom T-Shirt" product with line-item attributes?** Shopify's `/cart/<variant_id>:1` permalink can't include line-item custom attributes — the cart endpoint loses them. We'd have to build a Storefront-API-driven cart flow (signed token, async cart create, redirect to checkout URL). That's a v2 lift. The per-order product approach works today with zero Storefront API plumbing.

**Side effect:** Shopify admin Products list will accumulate one entry per order. That's intentional — each is a real order with a real fulfillment manifest. You'll never edit them, just like you don't edit shipping labels after they print.

## Shared infrastructure with Anchor

Both brands point at:
- The same Shopify store (`bolthouse-vzgkujpc.myshopify.com`)
- The same Printful account + store_id (`18166792`)
- The same Neon DB (`brand_orders` table) — orders tagged by `brand_handle` column
- The same `RESEND_API_KEY` (account-scoped, not domain-scoped)
- The same order webhook code (shared via `lib/printful-api.ts` and the webhook handler)

They diverge on:
- Domain (`anchorhats.com` vs `pressprint.xyz`)
- Vercel project
- Facebook Page (per Meta ad best-practice)
- Resend signing secret (one per webhook endpoint)
- Resend domain (separate DNS verification per domain)
- Brand voice / storefront / catalog

## Why this shape

| Decision | Reasoning |
|---|---|
| Next.js Pages Router (not App Router) | Simpler for server-rendered storefronts; better for SSR product pages with database lookups; easier to test |
| Shopify Admin GraphQL via `client_credentials` (Zilla Operator Partner app) | One token type that works across both stores' worth of operations; no per-merchant OAuth flow needed since we own bolthouse |
| Printful "prepare + submit" pattern (not sync products) | Printful's `/sync/products` is gated to Manual/API stores. Our store is Shopify-connected. The workaround: per-order direct submission via `/orders` with file_id + catalog_variant_id from product metafields |
| Neon over Vercel Postgres or KV | Postgres relational model fits orders + future tables (customers, designs); free tier generous |
| SVG → PNG via `sharp` (not OpenAI gpt-image-1) | For Anchor's typographic embroidery — free, deterministic, perfect kerning. Press doesn't generate designs (customers upload) so `sharp` isn't strictly required, but stays in the dep list for consistency |

## Where to extend

| If you want to... | Touch this file(s) |
|---|---|
| Add a product to the catalog | `lib/press-catalog.ts` only |
| Change the upload UX | `pages/products/[id].tsx` (client) + `pages/api/preview.ts` (server) |
| Add a variant picker (size, color) | `pages/products/[id].tsx` + `pages/api/customize.ts` (pass variant choice) |
| Add abandoned-cart emails | New `pages/api/cron/abandoned-cart.ts` + Vercel Cron config |
| Add discount codes | Shopify admin (Discounts) + a banner in `pages/index.tsx` |
| Swap stock photos for lifestyle photos | `lib/press-catalog.ts` `cover_image` field, one URL per product |
| Add a new ad creative | `docs/PRESS_META_ADS.md` |
| Inspect order metrics | `/dashboard/<handle>` (shared route from Anchor template — exists via the shared `lib/orders-db.ts`) |
