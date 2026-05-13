/**
 * Printful API helper.
 *
 * Auth: Bearer <PRINTFUL_API_KEY> (private token from
 * https://developers.printful.com/tokens). Store-scoped operations
 * (sync products, orders) require X-PF-Store-Id; catalog and file
 * uploads do not.
 *
 * High-level operation: provisionSyncProduct() — given a Shopify
 * product/variant and a Printful catalog product, creates the print
 * file, looks up the correct catalog variant, and registers the
 * sync mapping. Called from /api/invest after the Shopify product
 * is created.
 */

const PRINTFUL_BASE = "https://api.printful.com";

/**
 * Map our human-readable printful_id (manufacturer SKU) → Printful's
 * numeric catalog product_id. Verified against the live catalog. New
 * SKUs need an entry here before they can be synced.
 *
 * IND4000 (Independent Trading) and OTTO19251 aren't carried by
 * Printful — substituted with Gildan 18500 hoodie and Yupoong 6245CM
 * dad hat, which are the closest equivalents in Printful's catalog.
 */
export const PRINTFUL_CATALOG_IDS: Record<string, number> = {
  BC3001: 71, // Bella + Canvas 3001 Unisex Staple T-Shirt
  GD18000: 145, // Gildan 18000 Crew Neck Sweatshirt
  IND4000: 146, // → Gildan 18500 Heavy Blend Hoodie (Printful substitute)
  OTTO19251: 206, // → Yupoong 6245CM Classic Dad Hat (Printful substitute)
};

/**
 * Default variant prefs per SKU for the initial smoke test. Apparel
 * defaults to Black/M; the dad hat is one-size in Black.
 */
export const PRINTFUL_DEFAULT_VARIANT: Record<string, { color: string; size: string }> = {
  BC3001: { color: "Black", size: "M" },
  GD18000: { color: "Black", size: "M" },
  IND4000: { color: "Black", size: "M" },
  OTTO19251: { color: "Black", size: "One size" },
};

function authHeaders(): Record<string, string> {
  const key = process.env.PRINTFUL_API_KEY;
  if (!key) throw new Error("PRINTFUL_API_KEY not set");
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

function storeHeaders(): Record<string, string> {
  const storeId = process.env.PRINTFUL_STORE_ID;
  if (!storeId) throw new Error("PRINTFUL_STORE_ID not set");
  return { ...authHeaders(), "X-PF-Store-Id": storeId };
}

async function pf<T = any>(
  path: string,
  opts: { method?: string; body?: any; storeScoped?: boolean } = {},
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const resp = await fetch(`${PRINTFUL_BASE}${path}`, {
    method: opts.method || "GET",
    headers: opts.storeScoped ? storeHeaders() : authHeaders(),
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await resp.text();
  if (!resp.ok) return { ok: false, status: resp.status, error: text.slice(0, 500) };
  try {
    const json = JSON.parse(text);
    return { ok: true, data: json.result ?? json };
  } catch {
    return { ok: false, status: resp.status, error: `non-json response: ${text.slice(0, 200)}` };
  }
}

export type CatalogVariant = {
  id: number;
  product_id: number;
  name: string;
  size: string;
  color: string;
  price: string;
  in_stock: boolean;
};

export type CatalogProduct = {
  id: number;
  title: string;
  brand: string | null;
  model: string;
  variants: CatalogVariant[];
  print_placements: string[];
};

export async function getCatalogProduct(catalogId: number): Promise<CatalogProduct | null> {
  const r = await pf<{ product: any; variants: CatalogVariant[] }>(`/products/${catalogId}`);
  if (!r.ok) return null;
  const placements = (r.data as any).product?.files?.map((f: any) => f.type) || [];
  return {
    id: r.data.product.id,
    title: r.data.product.title,
    brand: r.data.product.brand,
    model: r.data.product.model,
    variants: r.data.variants,
    print_placements: placements,
  };
}

/**
 * Find a Printful catalog variant by color + size. Falls back to
 * the first available match if exact color isn't found.
 */
export async function findCatalogVariant(
  catalogId: number,
  prefs: { color?: string; size?: string } = {},
): Promise<CatalogVariant | null> {
  const product = await getCatalogProduct(catalogId);
  if (!product) return null;
  const { color = "Black", size = "M" } = prefs;
  const exact = product.variants.find(
    (v) => v.color === color && v.size === size && v.in_stock,
  );
  if (exact) return exact;
  const sizeOnly = product.variants.find((v) => v.size === size && v.in_stock);
  if (sizeOnly) return sizeOnly;
  return product.variants.find((v) => v.in_stock) || product.variants[0] || null;
}

/**
 * Upload a file to Printful from a public URL. Returns the file_id
 * which can then be attached to sync products / orders.
 */
export async function uploadFile(
  url: string,
  opts: { filename?: string; type?: string } = {},
): Promise<{ ok: true; fileId: number } | { ok: false; error: string }> {
  const r = await pf<{ id: number }>(`/files`, {
    method: "POST",
    body: { url, filename: opts.filename, type: opts.type || "default" },
    storeScoped: true,
  });
  if (!r.ok) return { ok: false, error: `Printful /files ${r.status}: ${r.error}` };
  return { ok: true, fileId: r.data.id };
}

export type OrderMapping = {
  catalog_variant_id: number;
  file_id: number;
  placement: string;
};

export type PrepareMappingInput = {
  catalogProductId: number;
  color?: string;
  size?: string;
  printFileUrl: string;
  placement?: string; // "front", "back", "front_large", etc.
  brandName: string;
  garmentName: string;
};

/**
 * Prepare the data the order webhook will need to fulfill an order via
 * Printful: looks up the Printful catalog variant, uploads the print
 * file (returns a stable file_id), and packages both for persistence
 * to the Shopify product. The Shopify order webhook later reads these
 * back and forwards the order to Printful's /orders endpoint.
 *
 * Note: Shopify-connected Printful stores don't support sync-product
 * creation via API; this two-step pattern (prepare-at-provision,
 * submit-at-order) is the standard workaround.
 */
export async function prepareOrderMapping(
  input: PrepareMappingInput,
): Promise<{ ok: true; mapping: OrderMapping } | { ok: false; error: string }> {
  const variant = await findCatalogVariant(input.catalogProductId, {
    color: input.color,
    size: input.size,
  });
  if (!variant) {
    return {
      ok: false,
      error: `no in-stock variant for catalog ${input.catalogProductId} (${input.color}/${input.size})`,
    };
  }

  const fileUpload = await uploadFile(input.printFileUrl, {
    filename: `${input.brandName}-${input.garmentName}.png`.replace(/[^a-zA-Z0-9.-]/g, "_"),
  });
  if (!fileUpload.ok) return { ok: false, error: fileUpload.error };

  return {
    ok: true,
    mapping: {
      catalog_variant_id: variant.id,
      file_id: fileUpload.fileId,
      placement: input.placement || "front",
    },
  };
}

export type OrderRecipient = {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state_code: string;
  country_code: string;
  zip: string;
  phone?: string;
  email?: string;
};

export type OrderLineItem = {
  catalog_variant_id: number;
  file_id: number;
  placement?: string;
  /**
   * For embroidery placements only — hex thread color(s) Printful
   * should use. If omitted, defaults to white (#FFFFFF) since that's
   * the closest Printful thread to most tonal/cream designs. Allowed
   * values: see Printful catalog product /variants response, or
   * https://printful.com/embroidery-thread-colors.
   */
  thread_colors?: string[];
  quantity: number;
  retail_price: number;
};

/**
 * Printful requires a `thread_colors_<placement>` option alongside
 * any embroidery file. Maps the placement to the option id Printful
 * expects: "embroidery_front_large" → "thread_colors_front_large".
 */
function embroideryThreadOption(placement: string, threadColors?: string[]): { id: string; value: string[] } | null {
  if (!placement.startsWith("embroidery_")) return null;
  const suffix = placement.slice("embroidery_".length);
  return {
    id: `thread_colors_${suffix}`,
    value: threadColors && threadColors.length > 0 ? threadColors : ["#FFFFFF"],
  };
}

/**
 * Submit an order to Printful for fulfillment. Called from the Shopify
 * orders/create webhook handler after looking up the per-line-item
 * mapping from Shopify product metafields.
 *
 * `external_id` should be the Shopify order id so Printful and the
 * Zilla dashboard can cross-reference. `confirm: true` submits the
 * order for production immediately; `false` (default) leaves it as a
 * draft for review.
 */
export async function submitOrder(input: {
  externalId: string;
  recipient: OrderRecipient;
  items: OrderLineItem[];
  confirm?: boolean;
}): Promise<{ ok: true; orderId: number; status: string } | { ok: false; error: string }> {
  const body = {
    external_id: input.externalId,
    recipient: input.recipient,
    items: input.items.map((i) => {
      const placement = i.placement || "front";
      const threadOption = embroideryThreadOption(placement, i.thread_colors);
      return {
        variant_id: i.catalog_variant_id,
        quantity: i.quantity,
        retail_price: i.retail_price.toFixed(2),
        files: [{ id: i.file_id, type: placement }],
        ...(threadOption && { options: [threadOption] }),
      };
    }),
  };
  const path = input.confirm ? "/orders?confirm=1" : "/orders";
  const r = await pf<{ id: number; status: string }>(path, {
    method: "POST",
    body,
    storeScoped: true,
  });
  if (!r.ok) return { ok: false, error: `Printful /orders ${r.status}: ${r.error}` };
  return { ok: true, orderId: r.data.id, status: r.data.status };
}

/**
 * Convenience: resolve which Printful store is connected to a given
 * Shopify shop domain. Useful for initial setup when PRINTFUL_STORE_ID
 * isn't yet known.
 */
export async function findStoreByShopifyDomain(
  shopifyDomain: string,
): Promise<{ id: number; name: string } | null> {
  const r = await pf<Array<{ id: number; name: string; type: string; website?: string }>>(`/stores`);
  if (!r.ok) return null;
  return (
    r.data.find((s) => s.type === "shopify" && (s.website || "").includes(shopifyDomain)) ||
    r.data.find((s) => s.type === "shopify") ||
    null
  );
}
