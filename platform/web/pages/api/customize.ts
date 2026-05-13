/**
 * /api/customize — commit a customer's custom design.
 *
 * Body: { productId, designUrl, mockupUrl } — all from /api/preview.
 *
 * Side effects:
 *   1. Creates a one-off Shopify product titled "<Product> — Custom by
 *      <short id>" tagged `press:custom:<id>` and `press:<productId>`
 *      so the order webhook can find it later.
 *   2. Sets the variant to the Press retail price, inventoryPolicy:
 *      CONTINUE, publishes to all sales channels.
 *   3. Attaches the mockupUrl as the product's primary image.
 *   4. Uploads the designUrl to Printful (gets a file_id), resolves
 *      the catalog variant, writes both into Shopify product
 *      metafields under namespace `zilla` — the same shape the
 *      shared order webhook (apparel template) expects.
 *
 * Returns: { checkoutUrl } — Shopify permalink-cart URL the customer
 * gets redirected to.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { getPressProduct } from "@/lib/press-catalog";

export const config = { maxDuration: 60 };

async function shopifyToken(): Promise<{ shop: string; token: string }> {
  const shop = (process.env.SHOPIFY_SHOP_DOMAIN || process.env.HUSH_SHOP_DOMAIN)!;
  const clientId = process.env.SHOPIFY_DEVAPP_CLIENT_ID || process.env.HUSH_DEVAPP_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_DEVAPP_CLIENT_SECRET || process.env.HUSH_DEVAPP_CLIENT_SECRET;
  const r = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" }),
  });
  const { access_token } = await r.json();
  return { shop, token: access_token };
}

async function sgql(shop: string, token: string, query: string, variables: any = {}): Promise<any> {
  const r = await fetch(`https://${shop}/admin/api/2026-04/graphql.json`, {
    method: "POST",
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  return r.json();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method not allowed" });
  }

  const { productId, designUrl, mockupUrl } = req.body || {};
  if (!productId || !designUrl) {
    return res.status(400).json({ error: "missing productId or designUrl" });
  }
  const product = getPressProduct(productId);
  if (!product) return res.status(400).json({ error: `unknown product: ${productId}` });

  const customId = crypto.randomBytes(4).toString("hex");

  try {
    const { shop, token } = await shopifyToken();

    // 1. Create Shopify product
    const create = await sgql(shop, token,
      `mutation C($input: ProductInput!) {
         productCreate(input: $input) {
           product { id handle title }
           userErrors { field message }
         }
       }`,
      {
        input: {
          title: `${product.name} — Custom (#${customId})`,
          descriptionHtml: `<p>Your custom ${product.name.toLowerCase()}, made when you ordered it. ${product.lead_time}.</p>`,
          vendor: "Press",
          productType: product.category,
          tags: [`press:custom:${customId}`, `press:${productId}`, `zilla-printful:press-${productId}`],
          status: "ACTIVE",
        },
      }
    );
    if (!create.data?.productCreate?.product?.id) {
      return res.status(500).json({ error: "productCreate failed: " + JSON.stringify(create) });
    }
    const productGid = create.data.productCreate.product.id;

    // 2. Update variant price + inventory policy
    const lookup = await sgql(shop, token,
      `query($id: ID!) { product(id: $id) { variants(first: 1) { edges { node { id } } } } }`,
      { id: productGid }
    );
    const variantGid = lookup.data.product.variants.edges[0].node.id;
    await sgql(shop, token,
      `mutation U($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
         productVariantsBulkUpdate(productId: $productId, variants: $variants) {
           productVariants { id price }
           userErrors { field message }
         }
       }`,
      {
        productId: productGid,
        variants: [{
          id: variantGid,
          price: String(product.retail_price),
          inventoryPolicy: "CONTINUE",
          inventoryItem: { requiresShipping: true, tracked: false },
        }],
      }
    );

    // 3. Publish to every sales channel (Online Store is required for
    //    the cart permalink to resolve checkout).
    const pubs = await sgql(shop, token, `{ publications(first: 20) { edges { node { id } } } }`);
    const pubIds = pubs.data.publications.edges.map((e: any) => ({ publicationId: e.node.id }));
    if (pubIds.length) {
      await sgql(shop, token,
        `mutation P($id: ID!, $input: [PublicationInput!]!) {
           publishablePublish(id: $id, input: $input) { userErrors { field message } }
         }`,
        { id: productGid, input: pubIds }
      );
    }

    // 4. Attach the mockup as the product's primary image (if provided)
    if (mockupUrl) {
      await sgql(shop, token,
        `mutation M($productId: ID!, $media: [CreateMediaInput!]!) {
           productCreateMedia(productId: $productId, media: $media) {
             media { ... on MediaImage { id } }
             mediaUserErrors { field message }
           }
         }`,
        { productId: productGid, media: [{ originalSource: mockupUrl, alt: `${product.name} custom`, mediaContentType: "IMAGE" }] }
      );
    }

    // 5. Upload design to Printful (one-off file_id for this order)
    const pfHeaders = {
      Authorization: `Bearer ${process.env.PRINTFUL_API_KEY}`,
      "Content-Type": "application/json",
      "X-PF-Store-Id": process.env.PRINTFUL_STORE_ID!,
    };
    const pfFile = await fetch("https://api.printful.com/files", {
      method: "POST", headers: pfHeaders,
      body: JSON.stringify({ url: designUrl, filename: `press-${productId}-${customId}.png`, type: "default" }),
    });
    const pfFileData = await pfFile.json();
    const printfulFileId = pfFileData?.result?.id;
    if (!printfulFileId) {
      return res.status(500).json({ error: "Printful file upload failed: " + JSON.stringify(pfFileData) });
    }

    // 6. Resolve catalog variant id
    const catalogResp = await fetch(`https://api.printful.com/products/${product.printful_catalog_id}`, { headers: pfHeaders });
    const catalogData = await catalogResp.json();
    const catalogVariant = catalogData.result?.variants?.find((v: any) =>
      v.color === product.default_variant.color &&
      (product.default_variant.size === "Onesize" || product.default_variant.size === "One size"
        ? true
        : v.size === product.default_variant.size)
    ) || catalogData.result?.variants?.find((v: any) => v.color === product.default_variant.color);
    if (!catalogVariant) {
      return res.status(500).json({ error: "no catalog variant resolved" });
    }

    // 7. Set Shopify product metafields so the order webhook can route
    //    fulfillment without re-resolving anything.
    await sgql(shop, token,
      `mutation MF($metafields: [MetafieldsSetInput!]!) {
         metafieldsSet(metafields: $metafields) {
           metafields { key }
           userErrors { field message }
         }
       }`,
      {
        metafields: [
          { ownerId: productGid, namespace: "zilla", key: "printful_catalog_variant_id", value: String(catalogVariant.id), type: "number_integer" },
          { ownerId: productGid, namespace: "zilla", key: "printful_file_id", value: String(printfulFileId), type: "number_integer" },
          { ownerId: productGid, namespace: "zilla", key: "printful_placement", value: product.placement, type: "single_line_text_field" },
        ],
      }
    );

    // 8. Build the Shopify cart permalink → instant checkout
    const numericVariantId = String(variantGid).split("/").pop();
    const checkoutUrl = `https://${shop}/cart/${numericVariantId}:1`;

    return res.status(200).json({
      ok: true,
      checkoutUrl,
      productId: productGid,
      variantId: variantGid,
      customId,
    });
  } catch (e) {
    console.error("[customize]", e);
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
