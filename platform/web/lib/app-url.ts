import type { GetServerSidePropsContext } from "next";

/**
 * Resolve the app's public base URL (no trailing slash) inside
 * getServerSideProps so per-brand storefront URLs can be rendered
 * fully-qualified in the UI.
 *
 * Order of resolution:
 *   1. NEXT_PUBLIC_APP_URL (manual override)
 *   2. VERCEL_PROJECT_PRODUCTION_URL (Vercel-injected, canonical)
 *   3. Request host header (works on Vercel preview deployments)
 *   4. VERCEL_URL (per-deployment fallback)
 *   5. localhost:3000 (dev)
 */
export function getAppUrl(ctx?: Pick<GetServerSidePropsContext, "req">): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  const host = ctx?.req?.headers?.host;
  if (host) {
    const proto = (ctx?.req?.headers?.["x-forwarded-proto"] as string) || (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
