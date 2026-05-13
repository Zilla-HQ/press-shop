/**
 * Press homepage — single-product-grid storefront for custom DTC.
 *
 * Customer journey:
 *   1. Land here, see the brand promise + a grid of products they can
 *      put a design on.
 *   2. Click a product → /products/[id]
 *   3. On the product page: upload a design, preview the mockup, buy.
 *
 * Sister brand to Anchor (curated caps, Zilla-HQ/shopify-template-apparel).
 * Both live under Bolthouse — same Shopify store, same Printful, same
 * order webhook. Press is the open canvas; Anchor is the curated drop.
 */
import type { NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import { PRESS_CATALOG } from "@/lib/press-catalog";

const Press: NextPage = () => {
  return (
    <>
      <Head>
        <title>Press — Custom print, on demand.</title>
        <meta name="description" content="Upload your design. We print it on shirts, hoodies, caps, totes. Made-to-order in 7–11 days." />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      <div className="press">
        <header className="press__nav">
          <div className="press__wordmark">PRESS</div>
          <a href="#catalog" className="press__cta">Start designing</a>
        </header>

        <section className="press__hero">
          <div className="press__eyebrow">Custom print, on demand</div>
          <h1 className="press__headline">Bring the design.<br />We bring the rest.</h1>
          <p className="press__sub">
            Upload artwork, pick a blank — shirt, hoodie, cap, tote. We print it, embroider it,
            ship it. Made when you order it, on your doorstep in seven to eleven days.
          </p>
          <a href="#catalog" className="press__hero-cta">Pick a blank →</a>
        </section>

        <section className="press__catalog" id="catalog">
          <div className="press__eyebrow">The catalog</div>
          <div className="press__grid">
            {PRESS_CATALOG.map((p) => (
              <Link key={p.id} href={`/products/${p.id}`} className="press__card">
                <div className="press__card-image">
                  {/* Catalog cover image fetched server-side later;
                      for now show the category as a placeholder color. */}
                  <div className={`press__card-placeholder press__card-placeholder--${p.category.toLowerCase()}`}>
                    {p.category}
                  </div>
                </div>
                <div className="press__card-body">
                  <div className="press__card-meta">{p.category}</div>
                  <h3 className="press__card-title">{p.name}</h3>
                  <p className="press__card-desc">{p.description.split(".")[0]}.</p>
                  <div className="press__card-foot">
                    <span className="press__card-price">From ${p.retail_price}</span>
                    <span className="press__card-arrow">Design it →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="press__how">
          <div className="press__eyebrow">How it works</div>
          <ol className="press__how-steps">
            <li>
              <div className="press__how-num">1</div>
              <h3>Pick a blank</h3>
              <p>T-shirt, hoodie, cap, tote — Printful's best blanks, the ones premium brands actually use.</p>
            </li>
            <li>
              <div className="press__how-num">2</div>
              <h3>Upload your design</h3>
              <p>PNG with transparent background works best. We'll preview it on the blank before you buy.</p>
            </li>
            <li>
              <div className="press__how-num">3</div>
              <h3>We make it + ship it</h3>
              <p>Direct-to-garment print or stitched embroidery, made when you order. 2–3 days to print, 5–8 to ship.</p>
            </li>
          </ol>
        </section>

        <footer className="press__footer">
          <div>
            <div className="press__wordmark press__wordmark--small">PRESS</div>
            <div className="press__footer-tag">Custom print, on demand.</div>
          </div>
          <div className="press__footer-links">
            <Link href="/policies/shipping">Shipping</Link>
            <Link href="/policies/returns">Returns</Link>
            <Link href="/policies/privacy">Privacy</Link>
            <Link href="/policies/terms">Terms</Link>
          </div>
          <div className="press__footer-contact">
            <div>hello@pressprint.xyz</div>
            <div>A Bolthouse brand. Sister to Anchor.</div>
          </div>
        </footer>
      </div>

      <style jsx global>{`
        html, body { background: #FAFAF7; color: #1A1A1A; font-family: "Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif; scroll-behavior: smooth; }
      `}</style>
      <style jsx>{`
        .press { background: #FAFAF7; color: #1A1A1A; min-height: 100vh; }
        .press__eyebrow { text-transform: uppercase; letter-spacing: 0.12em; font-size: 11px; color: #888; margin-bottom: 12px; }
        .press__wordmark {
          font-family: "DM Serif Display", Georgia, serif; font-size: 22px;
          letter-spacing: 0.25em; font-weight: 400;
        }
        .press__wordmark--small { font-size: 18px; margin-bottom: 6px; }

        .press__nav {
          display: flex; justify-content: space-between; align-items: center;
          padding: 20px 40px; border-bottom: 1px solid #EAE6DD; position: sticky; top: 0;
          background: rgba(250, 250, 247, 0.92); backdrop-filter: blur(8px); z-index: 50;
        }
        .press__cta {
          background: #1A1A1A; color: #FAFAF7; padding: 10px 20px;
          font-size: 13px; font-weight: 500; border-radius: 4px;
          text-decoration: none;
        }

        .press__hero { padding: 96px 80px 64px; max-width: 1100px; margin: 0 auto; text-align: center; }
        .press__headline {
          font-family: "DM Serif Display", Georgia, serif; font-size: 72px; font-weight: 400;
          line-height: 1.0; margin-top: 6px;
        }
        .press__sub { color: #4A4A4A; font-size: 18px; line-height: 1.55; margin: 24px auto 0; max-width: 620px; }
        .press__hero-cta {
          display: inline-block; background: #1A1A1A; color: #FAFAF7;
          padding: 18px 36px; font-size: 14px; font-weight: 600;
          letter-spacing: 0.08em; text-transform: uppercase;
          text-decoration: none; margin-top: 32px;
        }
        .press__hero-cta:hover { background: #333; }

        .press__catalog { padding: 64px 80px; max-width: 1400px; margin: 0 auto; }
        .press__grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 24px; margin-top: 12px;
        }
        .press__card {
          display: block; background: #FFF; border: 1px solid #EAE6DD;
          color: inherit; text-decoration: none; transition: transform 0.15s ease;
        }
        .press__card:hover { transform: translateY(-2px); border-color: #1A1A1A; }
        .press__card-image { aspect-ratio: 1 / 1; background: #EAE6DD; overflow: hidden; }
        .press__card-placeholder {
          width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
          font-family: "DM Serif Display", Georgia, serif; font-size: 24px;
          color: #1A1A1A; opacity: 0.6;
        }
        .press__card-placeholder--apparel { background: linear-gradient(135deg, #E8E4D7 0%, #D6CFB8 100%); }
        .press__card-placeholder--headwear { background: linear-gradient(135deg, #DAD3BD 0%, #B9AE92 100%); }
        .press__card-placeholder--drinkware { background: linear-gradient(135deg, #E0DBC9 0%, #C5BCA1 100%); }
        .press__card-placeholder--bags { background: linear-gradient(135deg, #EDE9DC 0%, #D4CCB3 100%); }
        .press__card-body { padding: 24px; display: flex; flex-direction: column; gap: 8px; }
        .press__card-meta { text-transform: uppercase; letter-spacing: 0.12em; font-size: 11px; color: #888; }
        .press__card-title {
          font-family: "DM Serif Display", Georgia, serif; font-size: 22px; font-weight: 400;
        }
        .press__card-desc { color: #4A4A4A; font-size: 13px; line-height: 1.5; }
        .press__card-foot {
          display: flex; justify-content: space-between; align-items: baseline;
          margin-top: 8px;
        }
        .press__card-price { font-family: "DM Serif Display", Georgia, serif; font-size: 20px; }
        .press__card-arrow { color: #1A1A1A; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; }

        .press__how { padding: 96px 80px; max-width: 1100px; margin: 0 auto; }
        .press__how-steps {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 40px;
          list-style: none; padding: 0; margin: 24px 0 0;
        }
        .press__how-steps li { display: flex; flex-direction: column; gap: 12px; }
        .press__how-num {
          font-family: "DM Serif Display", Georgia, serif; font-size: 56px;
          color: #B5B0A4; line-height: 1;
        }
        .press__how-steps h3 {
          font-family: "DM Serif Display", Georgia, serif; font-size: 22px; font-weight: 400;
        }
        .press__how-steps p { color: #4A4A4A; font-size: 14px; line-height: 1.55; }

        .press__footer {
          padding: 56px 80px; border-top: 1px solid #EAE6DD;
          display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 32px;
          color: #888; font-size: 12px;
        }
        .press__footer-tag { color: #4A4A4A; font-size: 13px; }
        .press__footer-links { display: flex; flex-direction: column; gap: 8px; }
        .press__footer-links :global(a) { color: #888; text-decoration: none; }
        .press__footer-links :global(a:hover) { color: #1A1A1A; }
        .press__footer-contact { display: flex; flex-direction: column; gap: 8px; text-align: right; }

        @media (max-width: 768px) {
          .press__nav { padding: 14px 20px; }
          .press__hero { padding: 56px 20px 32px; }
          .press__headline { font-size: 44px; }
          .press__sub { font-size: 16px; }
          .press__catalog { padding: 32px 20px; }
          .press__grid { grid-template-columns: 1fr; }
          .press__how { padding: 56px 20px; }
          .press__how-steps { grid-template-columns: 1fr; gap: 32px; }
          .press__footer { grid-template-columns: 1fr; padding: 32px 20px; }
          .press__footer-contact { text-align: left; }
        }
      `}</style>
    </>
  );
};

export default Press;
