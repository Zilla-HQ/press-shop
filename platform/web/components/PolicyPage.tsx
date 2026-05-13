import type { ReactNode } from "react";
import Head from "next/head";
import Link from "next/link";

/**
 * Shared chrome for all /policies/* pages — minimal nav back to the
 * landing page, light theme matching the customer-facing storefront.
 */
export function PolicyPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <Head>
        <title>{title} — Press</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="policy">
        <header className="policy__nav">
          <Link href="/" className="policy__wordmark">PRESS</Link>
        </header>
        <main className="policy__main">
          <h1>{title}</h1>
          {children}
        </main>
        <footer className="policy__footer">
          <div>
            <Link href="/policies/shipping">Shipping</Link>
            <Link href="/policies/returns">Returns</Link>
            <Link href="/policies/privacy">Privacy</Link>
            <Link href="/policies/terms">Terms</Link>
          </div>
          <div>hello@pressprint.xyz</div>
        </footer>
      </div>
      <style jsx global>{`
        html, body { background: #FAFAF7; color: #1A1A1A; font-family: "Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif; }
      `}</style>
      <style jsx>{`
        .policy { min-height: 100vh; display: flex; flex-direction: column; }
        .policy__nav { padding: 20px 40px; border-bottom: 1px solid #EAE6DD; }
        .policy__wordmark {
          font-family: "DM Serif Display", Georgia, serif;
          font-size: 18px; letter-spacing: 0.2em; color: #1A1A1A; text-decoration: none;
        }
        .policy__main {
          max-width: 720px; margin: 0 auto; padding: 80px 40px; flex: 1;
        }
        .policy__main :global(h1) {
          font-family: "DM Serif Display", Georgia, serif;
          font-size: 40px; font-weight: 400; margin-bottom: 32px;
        }
        .policy__main :global(h2) {
          font-family: "DM Serif Display", Georgia, serif;
          font-size: 22px; font-weight: 400; margin-top: 40px; margin-bottom: 12px;
        }
        .policy__main :global(p) {
          color: #4A4A4A; font-size: 15px; line-height: 1.65; margin-bottom: 16px;
        }
        .policy__main :global(ul) {
          color: #4A4A4A; font-size: 15px; line-height: 1.65; margin: 16px 0; padding-left: 24px;
        }
        .policy__main :global(li) { margin-bottom: 8px; }
        .policy__footer {
          padding: 40px; border-top: 1px solid #EAE6DD;
          display: flex; justify-content: space-between; flex-wrap: wrap; gap: 16px;
          color: #888; font-size: 12px;
        }
        .policy__footer div:first-child { display: flex; gap: 24px; }
        .policy__footer :global(a) { color: #888; text-decoration: none; }
        .policy__footer :global(a):hover { color: #1A1A1A; }
        @media (max-width: 768px) {
          .policy__nav { padding: 16px 20px; }
          .policy__main { padding: 48px 20px; }
          .policy__footer { padding: 24px 20px; }
        }
      `}</style>
    </>
  );
}
