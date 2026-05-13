/**
 * Shopify Admin API helper for the platform side.
 *
 * Mints fresh Admin API tokens via client_credentials grant against
 * the operator store (e.g. the apparel `bolthouse-…` store), runs
 * Admin GraphQL mutations, and exposes one high-level operation:
 * createBrandedProduct().
 *
 * createBrandedProduct (called by /api/invest) creates one Shopify
 * product per brand:
 *   1. Title "<Brand> — <Garment>", productType "Apparel"
 *   2. Tags it `zilla-brand:<handle>` so the Storefront API can find
 *      it and `zilla-printful:<sku>` so an operator can trace the
 *      Printful catalog item
 *   3. Adds a default variant priced at the brand's MSRP
 *   4. Publishes it to the Headless sales channel so the Next.js
 *      brand storefront at /store/<handle> can render the real
 *      product card with a working checkout link.
 *
 * Env: SHOPIFY_SHOP_DOMAIN, SHOPIFY_DEVAPP_CLIENT_ID,
 *      SHOPIFY_DEVAPP_CLIENT_SECRET (legacy HUSH_* names still read
 *      as a fallback so existing deployments keep working).
 */
const ADMIN_API_VERSION = "2026-04";

type AdminGraphQLResponse<T = any> = { data?: T; errors?: any[] };

function shopifyEnv() {
  return {
    shop: process.env.SHOPIFY_SHOP_DOMAIN || process.env.HUSH_SHOP_DOMAIN,
    clientId: process.env.SHOPIFY_DEVAPP_CLIENT_ID || process.env.HUSH_DEVAPP_CLIENT_ID,
    clientSecret: process.env.SHOPIFY_DEVAPP_CLIENT_SECRET || process.env.HUSH_DEVAPP_CLIENT_SECRET,
  };
}

async function mintAdminToken(): Promise<string> {
  const { shop, clientId, clientSecret } = shopifyEnv();
  if (!shop || !clientId || !clientSecret) {
    throw new Error("SHOPIFY_SHOP_DOMAIN / SHOPIFY_DEVAPP_CLIENT_ID / SHOPIFY_DEVAPP_CLIENT_SECRET not set");
  }
  const resp = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });
  if (!resp.ok) throw new Error(`Token mint failed: ${resp.status} ${await resp.text()}`);
  const data = await resp.json();
  return data.access_token;
}

async function adminGraphQL<T = any>(query: string, variables: Record<string, unknown> = {}): Promise<AdminGraphQLResponse<T>> {
  const token = await mintAdminToken();
  const { shop } = shopifyEnv();
  const resp = await fetch(`https://${shop}/admin/api/${ADMIN_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!resp.ok) throw new Error(`Admin GraphQL ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

export type BrandedProductInput = {
  brand_name: string;
  brand_handle: string;
  tagline: string;
  product: {
    printful_id?: string;
    name: string;
    fabric?: string;
    weight_oz?: number | null;
    fit?: string;
    suggested_msrp_usd: number;
    monthly_revenue_p50_usd?: number;
  };
};

function buildDescription(brand: BrandedProductInput): string {
  const { product } = brand;
  const spec = [
    product.fabric,
    product.weight_oz ? `${product.weight_oz} oz` : null,
    product.fit,
  ]
    .filter(Boolean)
    .join(" · ");
  return `
<p>${brand.tagline || product.name + "."}</p>
${spec ? `<p>${spec}.</p>` : ""}
<p>Made to order. Printed and shipped within 2–5 business days by Printful.</p>
`.trim();
}

export type CreateProductResult =
  | {
      ok: true;
      productId: string;
      productHandle: string;
      variantId: string | null;
      publishedToHeadless: boolean;
    }
  | { ok: false; error: string };

export type AdminProduct = {
  id: string;
  handle: string;
  title: string;
  vendor: string;
  tags: string[];
  description: string;
  variantId: string | null;
  price: string;
  available: boolean;
  imageUrl: string | null;
};

/**
 * Set product metafields. Used to persist Printful order-fulfillment
 * data (catalog_variant_id, file_id, placement) on the Shopify product
 * so the orders/create webhook can read them back per line item.
 */
export async function setProductMetafields(
  productId: string,
  fields: Array<{ namespace: string; key: string; value: string; type: string }>,
): Promise<{ ok: boolean; error?: string }> {
  const mutation = `
    mutation SetMetafields($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id namespace key }
        userErrors { field message code }
      }
    }
  `;
  const metafields = fields.map((f) => ({ ownerId: productId, ...f }));
  try {
    const resp = await adminGraphQL<{ metafieldsSet: any }>(mutation, { metafields });
    const errors = resp.data?.metafieldsSet?.userErrors;
    if (errors?.length) return { ok: false, error: JSON.stringify(errors) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Fetch a brand's product from the Admin API by tag.
 * Used as a fallback when the Storefront API hasn't caught up to a
 * newly-created product (Storefront API caches for ~60s; Admin is live).
 */
export async function getBrandProductViaAdmin(brandHandle: string): Promise<AdminProduct | null> {
  const query = `
    query BrandProduct($q: String!) {
      products(first: 1, query: $q) {
        edges { node {
          id handle title vendor tags description
          variants(first: 1) {
            edges { node { id availableForSale price } }
          }
          images(first: 1) { edges { node { url } } }
        } }
      }
    }
  `;
  try {
    const resp = await adminGraphQL<{ products: { edges: any[] } }>(query, {
      q: `tag:"zilla-brand:${brandHandle}"`,
    });
    const node = resp.data?.products?.edges?.[0]?.node;
    if (!node) return null;
    const variant = node.variants?.edges?.[0]?.node;
    return {
      id: node.id,
      handle: node.handle,
      title: node.title,
      vendor: node.vendor,
      tags: node.tags || [],
      description: node.description || "",
      variantId: variant?.id || null,
      price: variant?.price || "0",
      available: !!variant?.availableForSale,
      imageUrl: node.images?.edges?.[0]?.node?.url || null,
    };
  } catch {
    return null;
  }
}

export async function createBrandedProduct(brand: BrandedProductInput): Promise<CreateProductResult> {
  // 1. Create the product
  const createMutation = `
    mutation ProductCreate($input: ProductInput!) {
      productCreate(input: $input) {
        product { id handle title }
        userErrors { field message }
      }
    }
  `;
  const tags = [`zilla-brand:${brand.brand_handle}`];
  if (brand.product.printful_id) {
    tags.push(`zilla-printful:${brand.product.printful_id}`);
  }
  const createInput = {
    title: `${brand.brand_name} — ${brand.product.name}`,
    descriptionHtml: buildDescription(brand),
    vendor: brand.brand_name,
    productType: "Apparel",
    tags,
    status: "ACTIVE",
  };
  let createResp: AdminGraphQLResponse<{ productCreate: any }>;
  try {
    createResp = await adminGraphQL(createMutation, { input: createInput });
  } catch (e) {
    return { ok: false, error: `productCreate threw: ${e instanceof Error ? e.message : String(e)}` };
  }
  const created = createResp.data?.productCreate;
  if (!created?.product?.id) {
    return {
      ok: false,
      error: `productCreate failed: ${JSON.stringify(created?.userErrors || createResp.errors)}`,
    };
  }
  const productId = created.product.id;
  const productHandle = created.product.handle;

  // 2. productCreate already creates a default variant (price $0).
  //    Look it up, then UPDATE its price to the brand's MSRP — calling
  //    productVariantsBulkCreate would add a second variant (or silently
  //    fail) and leave the original $0 default in place, which causes
  //    Shopify's checkout to throw "something went wrong."
  let variantId: string | null = null;
  try {
    const lookup = await adminGraphQL<{ product: any }>(
      `query($id: ID!) { product(id: $id) { variants(first: 1) { edges { node { id } } } } }`,
      { id: productId },
    );
    variantId = lookup.data?.product?.variants?.edges?.[0]?.node?.id || null;
  } catch {}

  if (variantId) {
    const updateMutation = `
      mutation ProductVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) {
          productVariants { id price }
          userErrors { field message }
        }
      }
    `;
    try {
      await adminGraphQL(updateMutation, {
        productId,
        variants: [{
          id: variantId,
          price: String(brand.product.suggested_msrp_usd),
          inventoryPolicy: "CONTINUE",
          inventoryItem: { requiresShipping: true, tracked: false },
        }],
      });
    } catch {
      // non-fatal — Shopify-side caller can still fix the variant manually
    }
  }

  // 3. Publish the product to every sales channel that exists on the
  //    store. Online Store is required for Shopify's /cart/<vid>:1
  //    permalink to resolve checkout; Headless is required for the
  //    Storefront API to surface the product. Publishing to all is
  //    the simplest correct default — operators can hide channels
  //    in Shopify admin later if they want finer control.
  const pubsResp = await adminGraphQL<{ publications: { edges: any[] } }>(`
    { publications(first: 20) { edges { node { id name } } } }
  `);
  const allEdges: Array<{ node: { id: string; name: string } }> =
    pubsResp.data?.publications?.edges || [];
  if (allEdges.length === 0) {
    return { ok: true, productId, productHandle, variantId, publishedToHeadless: false };
  }

  const publishMutation = `
    mutation Publish($id: ID!, $input: [PublicationInput!]!) {
      publishablePublish(id: $id, input: $input) {
        publishable { ... on Product { id } }
        userErrors { field message }
      }
    }
  `;
  let publishedToHeadless = false;
  try {
    await adminGraphQL(publishMutation, {
      id: productId,
      input: allEdges.map((e) => ({ publicationId: e.node.id })),
    });
    publishedToHeadless = allEdges.some(
      (e) => typeof e.node.name === "string" && e.node.name.toLowerCase().includes("headless"),
    );
  } catch {
    return { ok: true, productId, productHandle, variantId, publishedToHeadless: false };
  }

  return { ok: true, productId, productHandle, variantId, publishedToHeadless };
}
