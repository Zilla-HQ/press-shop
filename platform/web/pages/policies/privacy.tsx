import { PolicyPage } from "@/components/PolicyPage";

export default function Privacy() {
  return (
    <PolicyPage title="Privacy">
      <p>Last updated: May 2026.</p>

      <h2>What we collect</h2>
      <ul>
        <li>Order info you give us at checkout: name, shipping address, email, phone (optional)</li>
        <li>Payment info — processed by Shopify and Stripe; we don't store card numbers</li>
        <li>Browsing data — page views, clicks, time on site — via cookies (Meta Pixel, Shopify analytics)</li>
      </ul>

      <h2>What we do with it</h2>
      <ul>
        <li>Fulfill your order (shared with Printful for production + shipping)</li>
        <li>Send you order confirmation and shipping updates</li>
        <li>Improve the site and the product</li>
        <li>Show ads on Meta and Google to people like you (if you opt in)</li>
      </ul>

      <h2>What we don't do</h2>
      <ul>
        <li>Sell your information to data brokers</li>
        <li>Share with third parties beyond order fulfillment partners</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        We use cookies for analytics, ad attribution (Meta Pixel), and the Shopify checkout
        flow. You can clear them in your browser settings any time.
      </p>

      <h2>Your rights</h2>
      <p>
        Email <strong>hello@pressprint.xyz</strong> to request a copy of your data or to ask us to
        delete it. We'll respond within 7 days.
      </p>
    </PolicyPage>
  );
}
