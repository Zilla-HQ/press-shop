# Setup — Press, clone to live store

End-to-end deployment guide. Assumes you have:
- A GitHub account
- A Vercel account
- The Bolthouse Shopify store credentials (shared with Anchor)
- A Printful account connected to Bolthouse
- A Resend account

Estimated total time: **45 minutes**.

---

## Phase 1 — Vercel project (10 min)

1. **Vercel** → **Add New → Project** → import `Zilla-HQ/press-shop`
2. **Root Directory: `platform/web`** ← critical. Without this, Vercel runs `npm install` at the repo root and the build fails
3. **Framework Preset**: Next.js (Vercel auto-detects)
4. **Build & Output Settings**: leave defaults
5. Click **Deploy**. First deploy will fail because env vars aren't set yet — expected.

---

## Phase 2 — Env vars (5 min)

In **Vercel → Press project → Settings → Environment Variables**, add (mark all Production + Preview + Development):

| Variable | Value | Where it's from |
|---|---|---|
| `SHOPIFY_SHOP_DOMAIN` | `bolthouse-vzgkujpc.myshopify.com` | Shared with Anchor |
| `SHOPIFY_DEVAPP_CLIENT_ID` | (from Zilla Operator Partner app) | Same as Anchor |
| `SHOPIFY_DEVAPP_CLIENT_SECRET` | (from Zilla Operator Partner app) | Same as Anchor |
| `PRINTFUL_API_KEY` | (from developers.printful.com/tokens) | Same as Anchor |
| `PRINTFUL_STORE_ID` | `18166792` | Same as Anchor |
| `DATABASE_URL` | (Neon Postgres URL) | Same as Anchor |
| `RESEND_API_KEY` | (from Resend → API keys) | Account-level, same as Anchor |
| `RESEND_WEBHOOK_SECRET` | (Press-specific) | Generated when you add the Press webhook in Resend |

Optional toggles:
- `PRINTFUL_AUTO_CONFIRM=1` — confirms orders for production instead of leaving as drafts
- `NEXT_PUBLIC_APP_URL=https://pressprint.xyz` — override canonical URL

After adding, **Redeploy** (Deployments → latest → ⋯ → Redeploy).

---

## Phase 3 — Domain (5 min, then 10–60 min DNS propagation)

1. **Vercel → Press project → Settings → Domains** → Add → type `pressprint.xyz` (or whatever your domain is)
2. If you bought through Vercel, DNS auto-configures. If through another registrar, follow Vercel's DNS instructions.
3. Wait until the green "Valid Configuration" check appears (~10 min typically)
4. Visit `https://pressprint.xyz` — should show the Press homepage

---

## Phase 4 — Resend (10 min)

For Press to send/receive email at `@pressprint.xyz`:

1. **Resend → Domains → Add Domain → `pressprint.xyz`**
2. Resend gives you 4–5 DNS records (SPF TXT, DKIM CNAMEs, optional DMARC, optional MX for inbound)
3. **Vercel → DNS for `pressprint.xyz`** → add each record exactly as Resend showed
4. Wait 5–15 min, then **Resend → Domains → pressprint.xyz → Verify**. All records turn green.
5. **Resend → Webhooks → Add Endpoint → `https://pressprint.xyz/api/webhooks/resend`**
6. Pick events: `email.delivered`, `email.bounced`, `email.complained`, optionally `inbound.received`
7. Copy the signing secret (`whsec_...`) → add to Vercel env vars as `RESEND_WEBHOOK_SECRET` → Redeploy

---

## Phase 5 — Shopify verification (5 min)

The Shopify side is already set up because it's shared with Anchor. Just verify:

1. **bolthouse admin → Settings → Payments**: confirm Shopify Payments active + bank account connected
2. **Settings → Shipping**: confirm Printful → US zone → Economy $4.95 rate is configured
3. **Settings → Taxes**: confirm US sales tax is calculating for your nexus state
4. **Settings → Notifications → Webhooks**: confirm `Order creation` webhook is registered to either Anchor's or Press's `/api/webhooks/shopify/order-created` URL. One URL handles both brands' orders.

---

## Phase 6 — End-to-end test purchase (10 min)

The critical step. Don't skip and don't spend ad money before this passes.

1. Open `https://pressprint.xyz` → click any product card → upload a PNG → click **Preview**
2. After ~10–15 seconds you see the mockup with your design on the product
3. Click **Buy** → redirects to Shopify cart → click Checkout
4. Pay with your own card (real $)
5. Within 30 seconds, verify all four:

| Surface | What you should see |
|---|---|
| **Shopify admin → Orders** | New paid order |
| **Vercel logs (Press project)** | `[webhook] orders/create...` and `[printful] order submitted, status=draft` |
| **Printful dashboard → Orders** | New **draft** order with the customer design + your address |
| **Neon `brand_orders` table** | New row with `brand_handle` matching the product tag (e.g. `press-tee`) |

6. **Refund yourself** in Shopify admin → Orders → ⋯ → Refund

If all four happened, Press is production-ready. If something failed, check Vercel logs for the `[preview]`, `[customize]`, or `[webhook]` lines — each step has verbose logging.

---

## Phase 7 — Meta sales channel (15 min, when ready to advertise)

1. **bolthouse admin → Apps → search "Meta" → install** Facebook & Instagram by Meta
2. Sign in with your Meta Business Account (create at business.facebook.com if you don't have one)
3. Create or connect:
   - A separate **Facebook Page** for Press (don't share with Anchor — see `docs/PRESS_META_ADS.md`)
   - An Ad Account
   - **Meta Pixel + Conversion API** (both enabled)
4. Sync product catalog to Meta Commerce Manager
5. Install Meta Pixel Helper (browser extension) → load pressprint.xyz → confirm `PageView` fires

---

## Phase 8 — Launch ads (per `docs/PRESS_META_ADS.md`)

Three ad sets, each $15–20/day, running in parallel:
- **Designer** — targets graphic designers / Procreate / Figma users
- **Small Biz** — targets Etsy sellers / Shopify merchants / podcasters
- **Inside Jokes** — targets bachelor parties / birthday gifts / group activities

See `docs/PRESS_META_ADS.md` for the exact copy, audiences, and image specs.

---

## Common gotchas

| Problem | Cause | Fix |
|---|---|---|
| `/api/preview` returns 500 with "SHOPIFY_DEVAPP_* not set" | Env vars missing in Vercel | Phase 2 — add them, redeploy |
| Upload returns 413 "payload too large" | Image > 10MB | Compress the image, or raise the limit in `/api/preview.ts` |
| Cart button redirects to "Something went wrong" on Shopify | Variant price not set OR product not published to Online Store | Check Phase 6 — should be auto-handled by `customize.ts` but if a bug regresses it |
| Mockup generation times out | Printful API slowness or rate limit | Retry; add a longer poll loop or implement retry-with-backoff |
| HMAC verification fails on order webhook | `SHOPIFY_DEVAPP_CLIENT_SECRET` doesn't match Partner app secret | Re-copy from Partner dashboard → Zilla Operator → Credentials |
| Resend test event returns 401 from your endpoint | Signing secret mismatch | Re-copy from Resend webhook page, save to Vercel, redeploy |

---

## Rotation checklist (post-launch)

All values in `.env.example` should be rotated since they were pasted in chat during initial setup. Order matters:

1. **Printful API key** — Settings → API → Revoke + create new → swap in Vercel for **both** projects
2. **Shopify app secret** — Partner dashboard → Zilla Operator → Rotate → swap in Vercel for **both** projects
3. **Resend API key** — Resend → API keys → revoke + create new → swap in Vercel for **both** projects
4. **Resend webhook secret** — separate per webhook endpoint; rotate via Resend → Webhooks → endpoint → Reset

OpenAI key isn't used in Press (no AI generation). Skip.
