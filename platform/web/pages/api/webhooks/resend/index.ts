/**
 * Resend webhook receiver.
 *
 * One endpoint handles all Resend event types — delivery/bounce/open
 * notifications for emails we send, AND inbound emails received at
 * hello@anchorhats.com (or any other address on the domain).
 *
 * Configure in Resend dashboard → Webhooks → Add Endpoint with:
 *   URL:    https://anchorhats.com/api/webhooks/resend
 *   Events: choose what you want surfaced. For initial launch:
 *           - email.delivered, email.bounced, email.complained
 *             (outbound deliverability monitoring)
 *           - inbound.received (customer service routing)
 *
 * The signing secret Resend gives you goes into RESEND_WEBHOOK_SECRET.
 * Without that env var set, signature verification is skipped — fine
 * for development, but enable it before going live so a bad actor
 * can't spam the endpoint with fake events.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";

export const config = { api: { bodyParser: false } };

async function readRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) chunks.push(chunk as Uint8Array);
  return Buffer.concat(chunks);
}

/**
 * Resend signs webhooks with Svix headers. Verifies:
 *   svix-id, svix-timestamp, svix-signature
 * against HMAC-SHA256 of `${id}.${timestamp}.${body}` using the
 * webhook secret (decoded from `whsec_<base64>` format).
 */
function verifySignature(req: NextApiRequest, rawBody: Buffer): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return true; // dev mode: no signing secret configured, skip
  const id = req.headers["svix-id"] as string | undefined;
  const ts = req.headers["svix-timestamp"] as string | undefined;
  const sigHeader = req.headers["svix-signature"] as string | undefined;
  if (!id || !ts || !sigHeader) return false;

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${id}.${ts}.${rawBody.toString("utf-8")}`;
  const expected = crypto
    .createHmac("sha256", new Uint8Array(secretBytes))
    .update(new Uint8Array(Buffer.from(signedContent)))
    .digest("base64");

  // Header is "v1,<sig> v1,<sig> ..." — accept if any version matches.
  return sigHeader.split(" ").some((part) => {
    const [, sig] = part.split(",");
    if (!sig) return false;
    try {
      return crypto.timingSafeEqual(
        new Uint8Array(Buffer.from(expected)),
        new Uint8Array(Buffer.from(sig)),
      );
    } catch {
      return false;
    }
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method not allowed" });
  }

  const rawBody = await readRawBody(req);
  if (!verifySignature(req, rawBody)) {
    return res.status(401).json({ error: "invalid signature" });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody.toString("utf-8"));
  } catch {
    return res.status(400).json({ error: "invalid json" });
  }

  const type = event?.type;
  const data = event?.data || {};

  // For now: log every event to Vercel function logs. Future:
  // route inbound emails to a CRM, persist delivery metrics, fire
  // operator notifications.
  switch (type) {
    case "email.delivered":
    case "email.opened":
    case "email.clicked":
      console.log(`[resend] ${type} to=${data.to} subject=${data.subject}`);
      break;
    case "email.bounced":
    case "email.complained":
    case "email.failed":
      console.warn(`[resend] ${type} to=${data.to} subject=${data.subject} reason=${data.bounce_type || data.reason}`);
      break;
    case "inbound.email":
    case "inbound.received":
      console.log(`[resend][inbound] from=${data.from} to=${data.to} subject=${data.subject}`);
      // TODO: route to support inbox (Slack / Linear / Gmail forward)
      break;
    default:
      console.log(`[resend] unknown event type=${type}`);
  }

  return res.status(200).json({ ok: true });
}
