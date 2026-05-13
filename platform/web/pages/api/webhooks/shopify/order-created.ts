/**
 * Shopify orders/create webhook → Printful fulfillment.
 *
 * Registration: Shopify Partner → Apps → Zilla Operator → API access →
 * Webhooks. Add a topic of `orders/create` pointing at
 * `https://<your-domain>/api/webhooks/shopify/order-created` with the
 * "JSON" format. Shopify signs the body with the app's API secret; we
 * verify the X-Shopify-Hmac-Sha256 header before processing.
 *
 * Flow per webhook:
 *   1. Verify HMAC signature
 *   2. For each line item, fetch the product metafields written by
 *      /api/invest (printful_catalog_variant_id, printful_file_id,
 *      printful_placement)
 *   3. POST the order to Printful with the resolved catalog variant +
 *      file. Idempotent on Shopify order id via external_id.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { submitOrder } from "@/lib/printful-api";
import { insertOrder } from "@/lib/orders-db";

// Disable Next's default body parser — we need the raw bytes for HMAC.
export const config = { api: { bodyParser: false } };

async function readRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) chunks.push(chunk as Uint8Array);
  return Buffer.concat(chunks);
}

function verifyShopifyHmac(rawBody: Buffer, signature: string | undefined): boolean {
  const secret = process.env.SHOPIFY_DEVAPP_CLIENT_SECRET || process.env.HUSH_DEVAPP_CLIENT_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(new Uint8Array(rawBody))
    .digest("base64");
  try {
    return crypto.timingSafeEqual(
      new Uint8Array(Buffer.from(expected)),
      new Uint8Array(Buffer.from(signature)),
    );
  } catch {
    return false;
  }
}

type ShopifyLineItem = {
  product_id: number;
  variant_id: number;
  title: string;
  quantity: number;
  price: string;
};

type ShopifyOrder = {
  id: number;
  order_number?: number;
  name?: string;
  email?: string;
  created_at?: string;
  total_price?: string;
  subtotal_price?: string;
  total_tax?: string;
  total_shipping_price_set?: { shop_money?: { amount?: string } };
  financial_status?: string;
  fulfillment_status?: string;
  shipping_address?: {
    name: string;
    address1: string;
    address2?: string;
    city: string;
    province_code: string;
    country_code: string;
    zip: string;
    phone?: string;
  };
  line_items: ShopifyLineItem[];
};

async function getProductData(
  productId: number,
): Promise<{ metafields: Record<string, string>; tags: string[] }> {
  const shop = (process.env.SHOPIFY_SHOP_DOMAIN || process.env.HUSH_SHOP_DOMAIN)!;
  const clientId = (process.env.SHOPIFY_DEVAPP_CLIENT_ID || process.env.HUSH_DEVAPP_CLIENT_ID)!;
  const clientSecret = (process.env.SHOPIFY_DEVAPP_CLIENT_SECRET || process.env.HUSH_DEVAPP_CLIENT_SECRET)!;

  const tokenResp = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" }),
  });
  const { access_token } = await tokenResp.json();

  const resp = await fetch(`https://${shop}/admin/api/2026-04/graphql.json`, {
    method: "POST",
    headers: { "X-Shopify-Access-Token": access_token, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `
        query ProductData($id: ID!) {
          product(id: $id) {
            tags
            metafields(first: 20, namespace: "zilla") {
              edges { node { key value } }
            }
          }
        }
      `,
      variables: { id: `gid://shopify/Product/${productId}` },
    }),
  });
  const data = await resp.json();
  const product = data?.data?.product;
  const edges = product?.metafields?.edges || [];
  return {
    metafields: Object.fromEntries(edges.map((e: any) => [e.node.key, e.node.value])),
    tags: product?.tags || [],
  };
}

function brandHandleFromTags(tags: string[]): string | null {
  for (const t of tags) {
    if (t.startsWith("zilla-brand:")) return t.slice("zilla-brand:".length);
  }
  return null;
}

function hashEmail(email: string | undefined): string | undefined {
  if (!email) return undefined;
  return crypto.createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 16);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method not allowed" });
  }

  const rawBody = await readRawBody(req);
  const signature = req.headers["x-shopify-hmac-sha256"] as string | undefined;
  if (!verifyShopifyHmac(rawBody, signature)) {
    return res.status(401).json({ error: "invalid signature" });
  }

  let order: ShopifyOrder;
  try {
    order = JSON.parse(rawBody.toString("utf-8"));
  } catch {
    return res.status(400).json({ error: "invalid json" });
  }

  if (!order.shipping_address) {
    return res.status(200).json({ skipped: "no shipping address (likely a draft)" });
  }

  // Resolve catalog variant + file + brand handle per line item.
  const items = [];
  let brandHandle: string | null = null;
  for (const li of order.line_items) {
    const { metafields, tags } = await getProductData(li.product_id);
    if (!brandHandle) brandHandle = brandHandleFromTags(tags);
    if (!metafields.printful_catalog_variant_id || !metafields.printful_file_id) {
      console.warn(`order ${order.id} line item ${li.product_id} has no Printful mapping — skipping`);
      continue;
    }
    items.push({
      catalog_variant_id: Number(metafields.printful_catalog_variant_id),
      file_id: Number(metafields.printful_file_id),
      placement: metafields.printful_placement || "front",
      quantity: li.quantity,
      retail_price: Number(li.price),
    });
  }

  if (items.length === 0) {
    return res.status(200).json({ skipped: "no Printful-mapped line items" });
  }

  const result = await submitOrder({
    externalId: String(order.id),
    recipient: {
      name: order.shipping_address.name,
      address1: order.shipping_address.address1,
      address2: order.shipping_address.address2,
      city: order.shipping_address.city,
      state_code: order.shipping_address.province_code,
      country_code: order.shipping_address.country_code,
      zip: order.shipping_address.zip,
      phone: order.shipping_address.phone,
      email: order.email,
    },
    items,
    confirm: process.env.PRINTFUL_AUTO_CONFIRM === "1",
  });

  if (!result.ok) {
    console.error(`printful order forward failed for ${order.id}:`, result.error);
    // Still persist the order so the dashboard reflects the sale even if
    // fulfillment failed; an operator can re-trigger Printful later.
  }

  // Persist to the orders DB for dashboard metrics. Failure here is
  // non-fatal — the Printful submit already happened.
  if (brandHandle) {
    try {
      await insertOrder({
        brand_handle: brandHandle,
        shopify_order_id: String(order.id),
        shopify_order_number: order.name || (order.order_number ? `#${order.order_number}` : undefined),
        printful_order_id: result.ok ? result.orderId : undefined,
        total_usd: Number(order.total_price ?? 0),
        subtotal_usd: order.subtotal_price ? Number(order.subtotal_price) : undefined,
        shipping_usd: order.total_shipping_price_set?.shop_money?.amount
          ? Number(order.total_shipping_price_set.shop_money.amount)
          : undefined,
        tax_usd: order.total_tax ? Number(order.total_tax) : undefined,
        status: result.ok ? "paid" : "fulfillment_failed",
        financial_status: order.financial_status || "paid",
        fulfillment_status: order.fulfillment_status || undefined,
        email_hash: hashEmail(order.email),
        line_items: order.line_items.map((li) => ({
          product_id: li.product_id,
          variant_id: li.variant_id,
          title: li.title,
          quantity: li.quantity,
          price: Number(li.price),
        })),
        created_at: order.created_at || new Date().toISOString(),
      });
    } catch (e) {
      console.error(`insertOrder for ${order.id} failed:`, e instanceof Error ? e.message : e);
    }
  }

  if (!result.ok) {
    return res.status(500).json({ ok: false, error: result.error, persisted: !!brandHandle });
  }
  return res.status(200).json({
    ok: true,
    printful_order_id: result.orderId,
    status: result.status,
    brand_handle: brandHandle,
  });
}
