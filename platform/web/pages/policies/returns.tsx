import { PolicyPage } from "@/components/PolicyPage";

export default function Returns() {
  return (
    <PolicyPage title="Returns">
      <p>
        Every Press product is made with your specific design — there's no warehouse, no stock
        pile, no inventory we can resell. Because of that, we don't accept open-ended
        buyer's-remorse returns. Here's how we handle returns honestly.
      </p>

      <h2>Defects: full refund or replacement, no questions</h2>
      <p>
        Print off-center, embroidery unraveling, wrong color or product, damaged in transit —
        email us a photo within 30 days of delivery and we'll either refund you or send a
        replacement. Your choice.
      </p>

      <h2>Wrong design on the item</h2>
      <p>
        If we printed something different from what you previewed and approved at checkout,
        that's on us — full refund or reprint. Email us a photo and the order number.
      </p>

      <h2>Changed your mind / disliked the design you uploaded</h2>
      <p>
        We can't accept returns for designs that came out exactly as previewed. The preview on
        the product page is the contract — if it looked right before you bought it, it's not
        a return-eligible reason. We can offer 15% off your next order as goodwill if it
        genuinely missed the mark.
      </p>

      <h2>How to start a return</h2>
      <p>
        Email <strong>hello@pressprint.xyz</strong> with your order number and (for defects) a
        photo. We respond within one business day.
      </p>

      <h2>What we can't take back</h2>
      <ul>
        <li>Items worn, washed, or used</li>
        <li>Returns requested more than 30 days after delivery</li>
        <li>International orders (we'll cover defects but can't pay return shipping)</li>
      </ul>
    </PolicyPage>
  );
}
