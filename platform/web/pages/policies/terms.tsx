import { PolicyPage } from "@/components/PolicyPage";

export default function Terms() {
  return (
    <PolicyPage title="Terms">
      <p>Last updated: May 2026.</p>

      <h2>Who's selling this</h2>
      <p>
        Press is operated by Bolthouse, a small apparel company. When you buy an Press cap,
        you're entering a transaction with Bolthouse. Payments are processed by Shopify and
        Stripe.
      </p>

      <h2>What you're buying</h2>
      <p>
        A made-to-order embroidered cap, manufactured by Printful and shipped directly to you.
        See <a href="/policies/shipping">shipping</a> for timeline.
      </p>

      <h2>Returns &amp; refunds</h2>
      <p>
        See our <a href="/policies/returns">returns policy</a>. The short version: defects get
        a full refund; otherwise we offer a 14-day store credit exchange.
      </p>

      <h2>Disputes</h2>
      <p>
        If something goes wrong, email us first — <strong>hello@press.shop</strong>. We'd
        rather solve a problem than escalate it. If we can't resolve it together, disputes
        will be handled under the laws of the United States.
      </p>

      <h2>Right to update</h2>
      <p>
        We may update these terms as the business grows. We won't apply changes retroactively
        to orders you've already placed.
      </p>
    </PolicyPage>
  );
}
