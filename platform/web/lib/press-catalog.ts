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
 *   3. Look up its `embroidery_*` or `default` / `front` placement
 *      from /mockup-generator/printfiles/<id>
 *   4. Add a row here; the storefront auto-renders a card.
 */

export type PressProduct = {
  id: string;
  name: string;
  category: "Apparel" | "Headwear" | "Drinkware" | "Bags";
  retail_price: number;
  wholesale_estimate: number;
  description: string;
  /** Printful catalog product id (number) used for /products and mockup gen */
  printful_catalog_id: number;
  /** Default variant (color + size). Used for blank mockup display + order. */
  default_variant: { color: string; size: string };
  /** Printful placement id, e.g. "front", "front_dtf", "embroidery_front_large" */
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
    lead_time: "Made + shipped in 7–11 days",
  },
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
];

export function getPressProduct(id: string): PressProduct | null {
  return PRESS_CATALOG.find((p) => p.id === id) ?? null;
}
