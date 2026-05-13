/**
 * Product detail — design a single Press product.
 *
 * Customer flow:
 *   1. Land here from the catalog grid
 *   2. Upload an image (PNG ideal, transparent bg)
 *   3. Click Preview → server uploads to Shopify CDN, hits Printful's
 *      mockup-generator API, returns a real mockup URL
 *   4. Click Buy → server creates a Shopify product with the design as
 *      the primary image, returns a Shopify cart permalink, redirect
 *   5. Customer pays on Shopify checkout, orders/create webhook fires,
 *      Printful prints + ships
 */
import { useRef, useState } from "react";
import type { GetServerSideProps, NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import { getPressProduct, PressProduct } from "@/lib/press-catalog";

type Props = { product: PressProduct };

const ProductDetail: NextPage<Props> = ({ product }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [mockupUrl, setMockupUrl] = useState<string | null>(null);
  const [designCdnUrl, setDesignCdnUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickFile(f: File) {
    setFile(f);
    setError(null);
    setMockupUrl(null);
    setDesignCdnUrl(null);
    const reader = new FileReader();
    reader.onload = () => setPreviewDataUrl(reader.result as string);
    reader.readAsDataURL(f);
  }

  async function handlePreview() {
    if (!file) return;
    setGenerating(true);
    setError(null);
    try {
      // Read the file as base64 so we can POST as JSON (avoids
      // multipart parsing on the server)
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Strip the "data:<mime>;base64," prefix; server expects raw base64
          const idx = result.indexOf("base64,");
          resolve(idx >= 0 ? result.slice(idx + "base64,".length) : result);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const resp = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          filename: file.name,
          mimeType: file.type,
          data,
        }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const j = await resp.json();
      setMockupUrl(j.mockupUrl);
      setDesignCdnUrl(j.designUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }

  async function handleBuy() {
    if (!designCdnUrl) return;
    setBuying(true);
    setError(null);
    try {
      const resp = await fetch("/api/customize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, designUrl: designCdnUrl, mockupUrl }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
      else throw new Error("no checkout url returned");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBuying(false);
    }
  }

  return (
    <>
      <Head>
        <title>{product.name} — Press</title>
        <meta name="description" content={product.description} />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      <div className="pd">
        <header className="pd__nav">
          <Link href="/" className="pd__wordmark">PRESS</Link>
          <Link href="/" className="pd__back">← All products</Link>
        </header>

        <div className="pd__layout">
          <div className="pd__visual">
            {mockupUrl ? (
              <img src={mockupUrl} alt={`${product.name} with your design`} />
            ) : previewDataUrl ? (
              <div className="pd__preview-stage">
                <div className="pd__preview-blank">Click <strong>Preview</strong> to render your design on the blank.</div>
                <img src={previewDataUrl} alt="your uploaded design" className="pd__preview-design" />
              </div>
            ) : (
              <div className="pd__visual-empty">
                <p>Upload a design →</p>
              </div>
            )}
          </div>

          <div className="pd__body">
            <div className="pd__eyebrow">{product.category}</div>
            <h1 className="pd__title">{product.name}</h1>
            <p className="pd__desc">{product.description}</p>
            <div className="pd__price">${product.retail_price}</div>
            <div className="pd__lead">{product.lead_time}</div>

            <div className="pd__step">
              <div className="pd__step-eyebrow">1. Upload your design</div>
              <p className="pd__step-hint">PNG with transparent background works best. Square images recommended.</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0])}
                style={{ display: "none" }}
              />
              <button className="pd__upload" onClick={() => fileInputRef.current?.click()}>
                {file ? `↻ Replace (${file.name})` : "Choose file →"}
              </button>
            </div>

            <div className="pd__step" aria-disabled={!file}>
              <div className="pd__step-eyebrow">2. Preview on the blank</div>
              <button className="pd__preview-btn" onClick={handlePreview} disabled={!file || generating}>
                {generating ? "Rendering…" : mockupUrl ? "Re-render" : "Preview →"}
              </button>
            </div>

            <div className="pd__step" aria-disabled={!mockupUrl}>
              <div className="pd__step-eyebrow">3. Buy</div>
              <button className="pd__buy" onClick={handleBuy} disabled={!mockupUrl || buying}>
                {buying ? "Creating your product…" : `Buy · $${product.retail_price}`}
              </button>
              <p className="pd__step-hint">You'll be sent to Shopify checkout. Made-to-order, ships in {product.lead_time.toLowerCase()}.</p>
            </div>

            {error && <div className="pd__error">{error}</div>}
          </div>
        </div>
      </div>

      <style jsx global>{`
        html, body { background: #FAFAF7; color: #1A1A1A; font-family: "Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif; }
      `}</style>
      <style jsx>{`
        .pd { background: #FAFAF7; color: #1A1A1A; min-height: 100vh; }
        .pd__eyebrow, .pd__step-eyebrow {
          text-transform: uppercase; letter-spacing: 0.12em; font-size: 11px; color: #888;
        }
        .pd__step-eyebrow { margin-bottom: 8px; }

        .pd__nav {
          display: flex; justify-content: space-between; align-items: center;
          padding: 20px 40px; border-bottom: 1px solid #EAE6DD;
        }
        .pd__wordmark {
          font-family: "DM Serif Display", Georgia, serif; font-size: 20px;
          letter-spacing: 0.25em; color: #1A1A1A; text-decoration: none;
        }
        .pd__back { color: #888; font-size: 12px; text-decoration: none; }
        .pd__back:hover { color: #1A1A1A; }

        .pd__layout {
          display: grid; grid-template-columns: 1fr 1fr; gap: 64px;
          padding: 64px 80px; max-width: 1400px; margin: 0 auto; align-items: start;
        }
        .pd__visual {
          position: sticky; top: 80px;
          aspect-ratio: 1; background: #EAE6DD;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
        }
        .pd__visual img { width: 100%; height: 100%; object-fit: cover; }
        .pd__visual-empty { color: #888; font-size: 14px; }
        .pd__preview-stage {
          position: relative; width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          background: #EAE6DD;
        }
        .pd__preview-blank {
          position: absolute; bottom: 24px; left: 24px; right: 24px;
          font-size: 12px; color: #888; text-align: center;
        }
        .pd__preview-design { max-width: 60%; max-height: 60%; object-fit: contain; }

        .pd__body { display: flex; flex-direction: column; gap: 16px; }
        .pd__title {
          font-family: "DM Serif Display", Georgia, serif; font-size: 42px; font-weight: 400;
          margin-top: 4px; line-height: 1.05;
        }
        .pd__desc { color: #4A4A4A; font-size: 15px; line-height: 1.55; }
        .pd__price { font-family: "DM Serif Display", Georgia, serif; font-size: 36px; margin-top: 8px; }
        .pd__lead { color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }

        .pd__step { padding: 20px 0; border-top: 1px solid #EAE6DD; }
        .pd__step:first-of-type { margin-top: 16px; }
        .pd__step[aria-disabled="true"] { opacity: 0.4; pointer-events: none; }
        .pd__step-hint { color: #888; font-size: 12px; margin-bottom: 12px; }

        .pd__upload, .pd__preview-btn, .pd__buy {
          background: #FFF; border: 1px solid #1A1A1A; color: #1A1A1A;
          padding: 14px 24px; font-size: 13px; font-weight: 600;
          letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer;
          font-family: inherit; transition: all 0.15s ease;
        }
        .pd__buy { background: #1A1A1A; color: #FAFAF7; padding: 18px 32px; }
        .pd__upload:hover:not(:disabled), .pd__preview-btn:hover:not(:disabled) { background: #1A1A1A; color: #FAFAF7; }
        .pd__buy:hover:not(:disabled) { background: #333; }
        .pd__upload:disabled, .pd__preview-btn:disabled, .pd__buy:disabled { cursor: not-allowed; opacity: 0.5; }

        .pd__error {
          background: #FBE5E5; color: #8B0000; padding: 12px 16px;
          font-size: 13px; border: 1px solid #E5B0B0;
          margin-top: 12px; white-space: pre-wrap; word-break: break-word;
        }

        @media (max-width: 768px) {
          .pd__nav { padding: 14px 20px; }
          .pd__layout { grid-template-columns: 1fr; padding: 24px 20px; gap: 32px; }
          .pd__visual { position: relative; top: 0; }
          .pd__title { font-size: 32px; }
          .pd__price { font-size: 28px; }
        }
      `}</style>
    </>
  );
};

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const id = String(ctx.params?.id ?? "");
  const product = getPressProduct(id);
  if (!product) return { notFound: true };
  return { props: { product } };
};

export default ProductDetail;
