import { PolicyPage } from "@/components/PolicyPage";

export default function Returns() {
  return (
    <PolicyPage title="Returns">
      <p>
        Every Press product is made with your specific design — there's no warehouse, no
        stockpile, no inventory we can resell. <strong>All sales are final, with one
        exception: defects.</strong>
      </p>

      <h2>Defects: full refund or replacement, no questions</h2>
      <p>
        Print off-center, embroidery unraveling, wrong color or product, damaged in transit —
        email us a photo within 30 days of delivery and we'll either refund you or send a
        replacement. Your choice. We respond within one business day.
      </p>

      <h2>Wrong design on the item</h2>
      <p>
        If we printed something different from what you previewed and approved at checkout,
        that's on us — full refund or reprint. Email a photo and the order number.
      </p>

      <h2>Everything else: final sale</h2>
      <p>
        Changed your mind, didn't like the design you uploaded, didn't fit, friend didn't like
        it — none of these are return-eligible. The preview on the product page is the
        contract: if it looked right before you bought it, it's a final sale. We can't accept
        returns for designs that came out exactly as previewed.
      </p>

      <h2>How to start a return</h2>
      <p>
        Email <strong>hello@pressprint.xyz</strong> with your order number and a photo of the
        defect. We respond within one business day.
      </p>

      <h2>What we can't take back</h2>
      <ul>
        <li>Items worn, washed, or used</li>
        <li>Returns requested more than 30 days after delivery</li>
        <li>Designs that printed exactly as previewed</li>
        <li>International orders (we'll cover defects but can't pay return shipping)</li>
      </ul>
    </PolicyPage>
  );
}
