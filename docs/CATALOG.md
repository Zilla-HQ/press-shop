# Catalog — adding + editing products

The Press catalog lives in **one file**: `platform/web/lib/press-catalog.ts`. Add a row, push, deploy — the homepage grid and `/products/<id>` page auto-render the new product.

---

## Add a new product

### 1. Find the Printful catalog id

Two ways:

**Via API** (preferred):
```bash
curl -H "Authorization: Bearer $PRINTFUL_API_KEY" https://api.printful.com/products | jq '.result[] | {id, title, type_name}' | grep -i mug
```

**Via Printful dashboard**: log in, browse the catalog at https://www.printful.com/products → click the product → URL contains `/products/<id>` somewhere or in the API tab.

### 2. Verify the catalog id + get variant info

```bash
curl -H "Authorization: Bearer $PRINTFUL_API_KEY" \
  https://api.printful.com/products/<catalog_id> \
  | jq '{title: .result.product.title, variants: .result.variants | length, sample: .result.variants[0]}'
```

Note:
- `title` — confirms it's the right product
- `variants` count — if > 10, you may need a size/color picker (see "Multi-variant products" below)
- `sample` — gives a `color`, `size`, and `price` to use as default

### 3. Get the printfile dimensions + placement

```bash
curl -H "Authorization: Bearer $PRINTFUL_API_KEY" -H "X-PF-Store-Id: $PRINTFUL_STORE_ID" \
  https://api.printful.com/mockup-generator/printfiles/<catalog_id> \
  | jq '{placements: .result.available_placements, printfiles: .result.printfiles[0]}'
```

Common placements:
- **`default`** — non-apparel single-print (mugs, stickers, posters)
- **`front`** — front print on apparel + tumblers
- **`back`**, **`sleeve_left`**, **`sleeve_right`** — additional apparel placements
- **`embroidery_front_large`** — caps (needs `thread_colors_front_large` option at order time, handled automatically)

### 4. Pick retail pricing

Target a 50%+ margin after shipping. See the table in this doc's parent README, or use this formula:

```
target_retail = (wholesale + estimated_ship_to_us) / 0.45
                ↑ where ship is ~$4.49 apparel, $5.99 mugs, $7.99 posters, $1.99 stickers
                ↑ 0.45 = "after ship, our cost is 55% of retail, leaving 45% margin"
```

For example, an item with $11 wholesale and $5 ship costs us $16. To net 50% margin: retail = $16 / 0.50 = $32.

### 5. Get a clean cover image

Use the Printful stock product photo for the default variant:

```bash
curl -H "Authorization: Bearer $PRINTFUL_API_KEY" https://api.printful.com/products/<catalog_id> \
  | jq '.result.variants[] | select(.color == "Black" and .size == "M") | .image'
```

Copy the URL (`https://files.cdn.printful.com/products/...`). It's stable enough for catalog use.

### 6. Add the row to `lib/press-catalog.ts`

```ts
{
  id: "your-slug",                  // /products/your-slug
  name: "Display Name",
  category: "Apparel",              // or one of the union values in the type
  retail_price: 32,
  wholesale_estimate: 11,
  description: "One sentence about the blank. Two if you must.",
  printful_catalog_id: 71,
  default_variant: { color: "Black", size: "M" },
  placement: "front",
  printfile: { width: 1800, height: 2400 },
  cover_image: "https://files.cdn.printful.com/products/...",
  lead_time: "Made + shipped in 7–11 days",
},
```

### 7. Test before pushing

```bash
cd platform/web && npm run build
```

Open http://localhost:3000 (after `npm run dev`) and confirm the new card appears + clicking it loads `/products/your-slug`.

### 8. Push

```bash
git add lib/press-catalog.ts && git commit -m "Add <product> to catalog" && git push
```

Vercel auto-redeploys. The new product is live in ~90 seconds.

---

## Change pricing on an existing product

Edit `retail_price` in the catalog row, push. The homepage updates immediately on next deploy.

**Note:** Pricing applies to *new* customer orders only. Customer-specific Shopify products already created (one per past order) retain their original price — that's a Shopify product, not a catalog config.

If you want to bulk-update past products' prices (rare — most orders are already paid), use the Shopify Admin GraphQL `productVariantsBulkUpdate` mutation.

---

## Swap stock photos for lifestyle photography

When you have real photos of products being used, swap the `cover_image` URL:

1. Upload your photos to Shopify Files (admin → Content → Files) or any CDN (Cloudinary, etc.)
2. Get the CDN URL (`https://cdn.shopify.com/s/files/.../your-photo.jpg`)
3. Update the `cover_image` field in `lib/press-catalog.ts`:

```ts
cover_image: "https://cdn.shopify.com/s/files/1/0750/4894/3670/files/lifestyle-tee.jpg?v=...",
```

Recommended specs:
- **Aspect ratio**: 1:1 (square) — homepage card uses `aspect-ratio: 1/1`
- **Dimensions**: at least 1080×1080 for retina; 1600×1600 ideal
- **Format**: JPG (smaller file size); WebP works too
- **Style**: clean, single subject, neutral background

---

## Multi-variant products (size + color pickers)

The current `default_variant` field locks every customer to one variant per product. For products with 20+ variants (phone cases by model, t-shirts by size), you'd want a variant picker on `/products/[id]`.

This isn't built yet. To add:

1. Expose `getCatalogVariants(catalogId)` in `lib/printful-api.ts` (already exists)
2. In `pages/products/[id].tsx`, fetch variants in `getServerSideProps` and render a picker UI
3. Pass the selected variant to `/api/customize` (currently it uses `product.default_variant`)
4. In `/api/customize`, resolve the catalog variant id from the picker selection instead of from defaults

**Time estimate:** ~2 hours for a basic picker. Worth doing before adding the iPhone case (31 variants) or expanding poster sizes (16 variants).

---

## Adding a new category

The category union is in `PressProduct.category`:
```ts
"Apparel" | "Headwear" | "Drinkware" | "Bags" | "Wall art" | "Stickers"
```

To add a new one:

1. Add it to the type union in `lib/press-catalog.ts`
2. Add a CSS placeholder gradient in `pages/index.tsx`:
```css
.press__card-placeholder--your-new-slug { background: linear-gradient(135deg, #FROMCOLOR 0%, #TOCOLOR 100%); }
```
3. The slug must match `category.toLowerCase().replace(/\s+/g, "-")` — e.g. "Home decor" → `home-decor`

---

## Removing a product

Delete the row from `PRESS_CATALOG`. The card disappears from the homepage and `/products/<id>` will 404. Customers who already bought are unaffected (their Shopify product exists independently).

---

## What gets validated when

| Stage | What's checked |
|---|---|
| `npm run build` | TypeScript types — does the catalog row match `PressProduct`? |
| First page load on Vercel | `getServerSideProps` for `/products/[id]` runs `getPressProduct(id)` — 404s if id doesn't match |
| First customer Preview attempt | Printful's `/products/<catalog_id>` call validates the catalog id; `/mockup-generator/printfiles/<id>` validates the placement |
| First customer Buy attempt | Shopify product creation, variant pricing, channel publishing — fails loudly if invalid |
| First customer Order webhook | Reads `zilla.printful_catalog_variant_id` metafield, submits to Printful — fails loudly if `placement` is wrong for that variant (e.g. cap embroidery requires thread_colors) |

The cap embroidery thread color is the most common gotcha — it's auto-derived in `submitOrder()` but the placement must be exactly `embroidery_<area>` (e.g. `embroidery_front_large`, not `embroidery_front`). See `lib/printful-api.ts` for the option-id derivation.

---

## When in doubt: copy an existing entry

The 8 entries in `lib/press-catalog.ts` cover 6 categories and 4 placement types (front, default, embroidery, wraparound). Pick the closest match, change the values, and the storefront does the rest.
