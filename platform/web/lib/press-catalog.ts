/**
 * Press catalog — the products customers can upload custom designs onto.
 *
 * Each entry maps a customer-facing card to a Printful catalog product
 * + the default variant we ship by default + the placement we put the
 * design on.
 *
 * Adding a product:
 *   1. Find the Printful catalog id from
 *      `GET https://api.printful.com/products`
 *   2. Pick a default variant (typically the most popular color/size)
 *   3. Look up its placement from /mockup-generator/printfiles/<id>
 *      (most non-apparel products use "default" or "front")
 *   4. Add a row here; the storefront auto-renders a card.
 */

export type PressProduct = {
  id: string;
  name: string;
  category: "Apparel" | "Headwear" | "Drinkware" | "Bags" | "Wall art" | "Stickers";
  retail_price: number;
  wholesale_estimate: number;
  description: string;
  /** Printful catalog product id (number) used for /products and mockup gen */
  printful_catalog_id: number;
  /** Default variant (color + size). Used for blank mockup display + order. */
  default_variant: { color: string; size: string };
  /** Printful placement id, e.g. "front", "front_dtf", "embroidery_front_large", "default" */
  placement: string;
  /** Printfile area dimensions for centering uploaded designs. */
  printfile: { width: number; height: number };
  /** For embroidery placements, default thread colors used by Printful. */
  embroidery_thread_default?: string[];
  /** Hero image for the catalog card. Falls back to Printful product photo. */
  cover_image?: string;
  /** Lead time copy for the card. */
  lead_time: string;
};

export const PRESS_CATALOG: PressProduct[] = [
  // === Apparel ============================================
  {
    id: "tee",
    name: "Heavyweight T-Shirt",
    category: "Apparel",
    retail_price: 32,
    wholesale_estimate: 11,
    description: "Bella + Canvas 3001. 100% combed ringspun cotton, 4.2 oz. The premium blank a lot of indie brands quietly use. Front DTG print.",
    printful_catalog_id: 71,
    default_variant: { color: "Black", size: "M" },
    placement: "front",
    printfile: { width: 1800, height: 2400 },
    cover_image: "https://cdn.shopify.com/s/files/1/0750/4894/3670/files/press-sample-tee-mockup.jpg?v=1778684587",
    lead_time: "Made + shipped in 7–11 days",
  },
  {
    id: "hoodie",
    name: "Heavyweight Hoodie",
    category: "Apparel",
    retail_price: 58,
    wholesale_estimate: 22,
    description: "Gildan 18500 heavy blend. 50/50 cotton-poly, 8 oz. Brushed inside for daily wear. Front DTG print.",
    printful_catalog_id: 146,
    default_variant: { color: "Black", size: "M" },
    placement: "front",
    printfile: { width: 1800, height: 2400 },
    cover_image: "https://cdn.shopify.com/s/files/1/0750/4894/3670/files/press-sample-hoodie-mockup.jpg?v=1778684599",
    lead_time: "Made + shipped in 7–11 days",
  },

  // === Headwear ===========================================
  {
    id: "cap",
    name: "Embroidered Dad Cap",
    category: "Headwear",
    retail_price: 32,
    wholesale_estimate: 15,
    description: "Yupoong 6245CM. Cotton twill, brass slider, one size adjustable. Direct-stitch embroidery on the front panel.",
    printful_catalog_id: 206,
    default_variant: { color: "Black", size: "One size" },
    placement: "embroidery_front_large",
    printfile: { width: 1650, height: 600 },
    embroidery_thread_default: ["#FFFFFF"],
    lead_time: "Made + shipped in 7–11 days",
  },

  // === Bags ===============================================
  {
    id: "tote",
    name: "Canvas Tote Bag",
    category: "Bags",
    retail_price: 28,
    wholesale_estimate: 11,
    description: "All-over print canvas tote. Roomy, single-color body, full-front print area.",
    printful_catalog_id: 84,
    default_variant: { color: "White", size: "One size" },
    placement: "front",
    printfile: { width: 1800, height: 1800 },
    lead_time: "Made + shipped in 7–11 days",
  },

  // === Drinkware ==========================================
  {
    id: "mug",
    name: "Ceramic Mug",
    category: "Drinkware",
    retail_price: 22,
    wholesale_estimate: 6,
    description: "11oz white glossy ceramic mug. Dishwasher + microwave safe. Full-wrap print. The universal merch item.",
    printful_catalog_id: 19,
    default_variant: { color: "White", size: "11 oz" },
    placement: "default",
    printfile: { width: 2700, height: 1050 },
    lead_time: "Made + shipped in 7–11 days",
  },
  {
    id: "tumbler",
    name: "Stainless Steel Tumbler",
    category: "Drinkware",
    retail_price: 38,
    wholesale_estimate: 25,
    description: "20oz tapered stainless steel tumbler. Double-walled insulation, fits standard cup holders. Wraparound print.",
    printful_catalog_id: 909,
    default_variant: { color: "White", size: "20oz" },
    placement: "front",
    printfile: { width: 2795, height: 2100 },
    lead_time: "Made + shipped in 7–11 days",
  },

  // === Wall art ===========================================
  {
    id: "poster",
    name: "Matte Paper Poster",
    category: "Wall art",
    retail_price: 28,
    wholesale_estimate: 12,
    description: "Enhanced matte paper, 192 g/m². Museum-grade thickness, fade-resistant. Multiple sizes; defaults to 12×16.",
    printful_catalog_id: 1,
    default_variant: { color: "White", size: "12″×16″" },
    placement: "default",
    printfile: { width: 4800, height: 3600 },
    lead_time: "Made + shipped in 7–11 days",
  },

  // === Stickers ===========================================
  {
    id: "sticker",
    name: "Kiss-Cut Sticker",
    category: "Stickers",
    retail_price: 8,
    wholesale_estimate: 3,
    description: "Glossy vinyl kiss-cut sticker, 3″×3″. Weatherproof, dishwasher-safe. For laptops, water bottles, helmets, anywhere.",
    printful_catalog_id: 358,
    default_variant: { color: "White", size: "3″×3″" },
    placement: "default",
    printfile: { width: 900, height: 900 },
    lead_time: "Made + shipped in 7–11 days",
  },
];

export function getPressProduct(id: string): PressProduct | null {
  return PRESS_CATALOG.find((p) => p.id === id) ?? null;
}
