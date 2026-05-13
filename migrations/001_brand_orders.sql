-- Zilla Apparel Template — Neon Postgres schema
--
-- One row per Shopify order, written by the
-- /api/webhooks/shopify/order-created handler after the Printful
-- submit. The dashboard at /dashboard/<handle> reads aggregated
-- metrics back via lib/orders-db.ts.
--
-- Run once against a fresh Neon database (via Neon's SQL Editor
-- or `psql $DATABASE_URL -f migrations/001_brand_orders.sql`).

CREATE TABLE brand_orders (
  id BIGSERIAL PRIMARY KEY,
  brand_handle TEXT NOT NULL,
  shopify_order_id TEXT NOT NULL UNIQUE,
  shopify_order_number TEXT,
  printful_order_id BIGINT,
  total_usd NUMERIC(10, 2) NOT NULL,
  subtotal_usd NUMERIC(10, 2),
  shipping_usd NUMERIC(10, 2),
  tax_usd NUMERIC(10, 2),
  status TEXT NOT NULL,
  financial_status TEXT,
  fulfillment_status TEXT,
  email_hash TEXT,
  line_items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_brand_orders_brand_handle_created_at
  ON brand_orders (brand_handle, created_at DESC);

CREATE INDEX idx_brand_orders_status
  ON brand_orders (status);
