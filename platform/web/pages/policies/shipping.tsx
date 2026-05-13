import { PolicyPage } from "@/components/PolicyPage";

export default function Shipping() {
  return (
    <PolicyPage title="Shipping">
      <p>
        Every Press product is made when you order it. Once you check out, Printful — our
        manufacturing partner — pulls the blank, prints or embroiders your design, and ships it
        directly to you. Nothing sits in a warehouse, nothing's pre-made.
      </p>

      <h2>Timeline</h2>
      <ul>
        <li><strong>Production:</strong> 2–3 business days</li>
        <li><strong>Shipping (US Economy):</strong> 5–8 business days (USPS)</li>
        <li><strong>Total order-to-door (US):</strong> 7–11 business days</li>
        <li><strong>Shipping (international):</strong> calculated at checkout, typically 7–14 business days</li>
      </ul>

      <h2>Shipping cost</h2>
      <p>
        Flat $4.95 for US Economy. International shipping is calculated at checkout based on
        destination and weight.
      </p>

      <h2>Tracking</h2>
      <p>
        You'll get a shipment notification with tracking info when Printful hands your order to
        the carrier — usually 2–3 days after you order.
      </p>
    </PolicyPage>
  );
}
