/**
 * Per-brand order persistence + dashboard metrics.
 *
 * The orders/create webhook writes one row per Shopify order to the
 * `brand_orders` table in Neon. The dashboard reads aggregate metrics
 * back via getBrandMetrics() to render revenue/AOV/refund-rate and
 * the 7-day chart in the same shape the supplement-template dashboard
 * already expected (AgentTick.state.orders).
 *
 * Requires DATABASE_URL (Vercel-Neon integration auto-provisions it
 * when you attach a Neon store to the project).
 */

import { neon } from "@neondatabase/serverless";

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  return neon(url);
}

export type OrderLineItemRow = {
  product_id: number;
  variant_id: number;
  title: string;
  quantity: number;
  price: number;
};

export type OrderInsertInput = {
  brand_handle: string;
  shopify_order_id: string;
  shopify_order_number?: string;
  printful_order_id?: number;
  total_usd: number;
  subtotal_usd?: number;
  shipping_usd?: number;
  tax_usd?: number;
  status: string;
  financial_status?: string;
  fulfillment_status?: string;
  email_hash?: string;
  line_items: OrderLineItemRow[];
  created_at: string; // ISO 8601
};

/**
 * Insert one Shopify order. Idempotent on shopify_order_id —
 * subsequent calls update mutable fields (status, fulfillment,
 * printful_order_id) instead of throwing.
 */
export async function insertOrder(input: OrderInsertInput): Promise<void> {
  const sql = db();
  await sql`
    INSERT INTO brand_orders (
      brand_handle, shopify_order_id, shopify_order_number, printful_order_id,
      total_usd, subtotal_usd, shipping_usd, tax_usd,
      status, financial_status, fulfillment_status, email_hash,
      line_items, created_at
    ) VALUES (
      ${input.brand_handle}, ${input.shopify_order_id}, ${input.shopify_order_number ?? null}, ${input.printful_order_id ?? null},
      ${input.total_usd}, ${input.subtotal_usd ?? null}, ${input.shipping_usd ?? null}, ${input.tax_usd ?? null},
      ${input.status}, ${input.financial_status ?? null}, ${input.fulfillment_status ?? null}, ${input.email_hash ?? null},
      ${JSON.stringify(input.line_items)}::jsonb, ${input.created_at}
    )
    ON CONFLICT (shopify_order_id) DO UPDATE SET
      printful_order_id = COALESCE(EXCLUDED.printful_order_id, brand_orders.printful_order_id),
      status = EXCLUDED.status,
      financial_status = EXCLUDED.financial_status,
      fulfillment_status = EXCLUDED.fulfillment_status,
      updated_at = now()
  `;
}

export type BrandMetrics = {
  lookback_days: number;
  as_of: string;
  total_orders: number;
  paid_orders: number;
  refunded_orders: number;
  revenue_paid: number;
  revenue_refunded: number;
  revenue_net: number;
  aov: number;
  refund_rate: number;
  last_7_days: Array<{ date: string; orders: number; revenue: number }>;
  activity: Array<{
    name: string;
    created_at: string;
    total: number;
    status: string;
    fulfillment: string | null;
    email_hash: string | null;
  }>;
};

/**
 * Aggregate metrics for the dashboard. Returns the same shape the
 * supplement template's AgentTick.state.orders carried so the
 * existing dashboard component renders unchanged.
 */
export async function getBrandMetrics(
  brandHandle: string,
  lookbackDays = 30,
): Promise<BrandMetrics> {
  const sql = db();
  const cutoffIso = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

  const totals = await sql`
    SELECT
      COUNT(*)::int AS total_orders,
      COUNT(*) FILTER (WHERE financial_status = 'paid')::int AS paid_orders,
      COUNT(*) FILTER (WHERE financial_status = 'refunded')::int AS refunded_orders,
      COALESCE(SUM(total_usd) FILTER (WHERE financial_status = 'paid'), 0)::float AS revenue_paid,
      COALESCE(SUM(total_usd) FILTER (WHERE financial_status = 'refunded'), 0)::float AS revenue_refunded
    FROM brand_orders
    WHERE brand_handle = ${brandHandle}
      AND created_at >= ${cutoffIso}
  ` as unknown as Array<{
    total_orders: number;
    paid_orders: number;
    refunded_orders: number;
    revenue_paid: number;
    revenue_refunded: number;
  }>;

  const t = totals[0] || { total_orders: 0, paid_orders: 0, refunded_orders: 0, revenue_paid: 0, revenue_refunded: 0 };
  const revenue_net = t.revenue_paid - t.revenue_refunded;
  const aov = t.paid_orders > 0 ? t.revenue_paid / t.paid_orders : 0;
  const refund_rate = t.total_orders > 0 ? t.refunded_orders / t.total_orders : 0;

  // 7-day rolling chart
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const dailyRows = (await sql`
    SELECT
      to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
      COUNT(*)::int AS orders,
      COALESCE(SUM(total_usd) FILTER (WHERE financial_status = 'paid'), 0)::float AS revenue
    FROM brand_orders
    WHERE brand_handle = ${brandHandle}
      AND created_at >= ${sevenDaysAgo}
    GROUP BY 1
    ORDER BY 1 ASC
  `) as unknown as Array<{ date: string; orders: number; revenue: number }>;

  // Fill in zero-rows for missing days so the chart has 7 bars
  const dailyMap = new Map(dailyRows.map((r) => [r.date, r]));
  const last_7_days: Array<{ date: string; orders: number; revenue: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().slice(0, 10);
    last_7_days.push(dailyMap.get(dateStr) || { date: dateStr, orders: 0, revenue: 0 });
  }

  // Recent activity (last 10 orders)
  const activityRows = (await sql`
    SELECT
      COALESCE(shopify_order_number, '#' || shopify_order_id) AS name,
      created_at,
      total_usd::float AS total,
      financial_status AS status,
      fulfillment_status AS fulfillment,
      email_hash
    FROM brand_orders
    WHERE brand_handle = ${brandHandle}
    ORDER BY created_at DESC
    LIMIT 10
  `) as unknown as Array<{
    name: string;
    created_at: string;
    total: number;
    status: string;
    fulfillment: string | null;
    email_hash: string | null;
  }>;

  return {
    lookback_days: lookbackDays,
    as_of: new Date().toISOString(),
    total_orders: t.total_orders,
    paid_orders: t.paid_orders,
    refunded_orders: t.refunded_orders,
    revenue_paid: t.revenue_paid,
    revenue_refunded: t.revenue_refunded,
    revenue_net,
    aov,
    refund_rate,
    last_7_days,
    activity: activityRows.map((r) => ({
      name: r.name,
      created_at: typeof r.created_at === "string" ? r.created_at : new Date(r.created_at).toISOString(),
      total: r.total,
      status: r.status || "unknown",
      fulfillment: r.fulfillment,
      email_hash: r.email_hash,
    })),
  };
}
