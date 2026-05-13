/**
 * /api/preview — receive a customer's design as base64, upload to
 * Shopify CDN, generate a Printful mockup, return the persistent URLs.
 *
 * Body: { productId: string, filename: string, mimeType: string, data: string (base64) }
 *
 * Returns: { designUrl, mockupUrl } — both are permanent Shopify CDN
 * URLs. Pass designUrl back to /api/customize when the customer commits
 * to buy; the mockup gets attached as the Shopify product image.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getPressProduct } from "@/lib/press-catalog";

export const config = {
  api: { bodyParser: { sizeLimit: "10mb" } },
  maxDuration: 60,
};

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

async function uploadToShopifyCDN(
  shop: string,
  token: string,
  buffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<string> {
  const staged = await sgql(shop, token,
    `mutation S($input: [StagedUploadInput!]!) {
       stagedUploadsCreate(input: $input) {
         stagedTargets { url resourceUrl parameters { name value } }
         userErrors { field message }
       }
     }`,
    { input: [{ filename, mimeType, httpMethod: "POST", resource: "FILE", fileSize: String(buffer.length) }] }
  );
  const target = staged.data.stagedUploadsCreate.stagedTargets[0];
  const fd = new FormData();
  for (const p of target.parameters) fd.append(p.name, p.value);
  fd.append("file", new Blob([new Uint8Array(buffer)], { type: mimeType }), filename);
  await fetch(target.url, { method: "POST", body: fd });

  const fc = await sgql(shop, token,
    `mutation F($files: [FileCreateInput!]!) {
       fileCreate(files: $files) {
         files { id ... on MediaImage { image { url } } }
         userErrors { field message }
       }
     }`,
    { files: [{ originalSource: target.resourceUrl, contentType: "IMAGE", alt: filename }] }
  );
  const fileId = fc.data.fileCreate.files[0].id;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const p = await sgql(shop, token,
      `query($id: ID!) { node(id: $id) { ... on MediaImage { image { url } } } }`,
      { id: fileId }
    );
    if (p.data?.node?.image?.url) return p.data.node.image.url;
  }
  throw new Error("Shopify CDN URL never resolved");
}

async function generatePrintfulMockup(
  catalogId: number,
  variantColor: string,
  variantSize: string,
  imageUrl: string,
  placement: string,
  printfile: { width: number; height: number },
): Promise<string> {
  const pfHeaders = {
    Authorization: `Bearer ${process.env.PRINTFUL_API_KEY}`,
    "Content-Type": "application/json",
    "X-PF-Store-Id": process.env.PRINTFUL_STORE_ID!,
  };

  const catalogResp = await fetch(`https://api.printful.com/products/${catalogId}`, { headers: pfHeaders });
  const catalogData = await catalogResp.json();
  const variant =
    catalogData.result?.variants?.find(
      (v: any) =>
        v.color === variantColor &&
        (variantSize === "Onesize" || variantSize === "One size" ? true : v.size === variantSize),
    ) || catalogData.result?.variants?.find((v: any) => v.color === variantColor);
  if (!variant) throw new Error(`no variant for ${catalogId}/${variantColor}/${variantSize}`);

  const designSize = Math.min(printfile.width, printfile.height);
  const position = {
    area_width: printfile.width,
    area_height: printfile.height,
    width: designSize,
    height: designSize,
    top: 0,
    left: Math.floor((printfile.width - designSize) / 2),
  };

  const taskResp = await fetch(`https://api.printful.com/mockup-generator/create-task/${catalogId}`, {
    method: "POST",
    headers: pfHeaders,
    body: JSON.stringify({
      variant_ids: [variant.id],
      format: "jpg",
      files: [{ placement, image_url: imageUrl, position }],
    }),
  });
  const taskData = await taskResp.json();
  const taskKey = taskData?.result?.task_key;
  if (!taskKey) throw new Error("Printful mockup task: " + JSON.stringify(taskData).slice(0, 200));

  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const r = await fetch(`https://api.printful.com/mockup-generator/task?task_key=${taskKey}`, { headers: pfHeaders });
    const d = await r.json();
    if (d?.result?.status === "completed") return d.result.mockups[0].mockup_url;
    if (d?.result?.status === "failed") throw new Error("Printful mockup failed: " + JSON.stringify(d).slice(0, 200));
  }
  throw new Error("Printful mockup timed out");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method not allowed" });
  }

  try {
    const { productId, filename, mimeType, data } = req.body || {};
    if (!productId || !data || !mimeType) {
      return res.status(400).json({ error: "missing productId, mimeType, or data" });
    }
    const product = getPressProduct(productId);
    if (!product) return res.status(400).json({ error: `unknown product: ${productId}` });

    const buffer = Buffer.from(data as string, "base64");
    const { shop, token } = await shopifyToken();

    // 1. Upload design to Shopify CDN
    const designUrl = await uploadToShopifyCDN(shop, token, buffer, mimeType, filename || `design.png`);

    // 2. Generate Printful mockup with the design on the blank
    const mockupTempUrl = await generatePrintfulMockup(
      product.printful_catalog_id,
      product.default_variant.color,
      product.default_variant.size,
      designUrl,
      product.placement,
      product.printfile,
    );

    // 3. Persist mockup to Shopify CDN (temporary S3 → permanent)
    const mockupResp = await fetch(mockupTempUrl);
    const mockupBuffer = Buffer.from(await mockupResp.arrayBuffer());
    const mockupUrl = await uploadToShopifyCDN(shop, token, mockupBuffer, "image/jpeg", `press-${productId}-mockup.jpg`);

    return res.status(200).json({ designUrl, mockupUrl });
  } catch (e) {
    console.error("[preview]", e);
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
