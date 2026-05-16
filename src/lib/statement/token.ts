import crypto from "crypto";

/**
 * Banka hesabi ekstresi icin HMAC-imzali token.
 *
 * Format: base64url(payloadJson) + "." + base64url(hmacSha256)
 *   payload = { aid: account_id, oid: organization_id, m: months, exp: unix }
 *
 * Token'i bilen herkes ekstreyi gorebilir; bu yuzden exp ile sinirlandirilmistir.
 * SECRET kaynagi:
 *   - process.env.STATEMENT_SECRET (oncelikli)
 *   - process.env.NEXTAUTH_SECRET / SUPABASE_JWT_SECRET (fallback)
 */

export type StatementPayload = {
  aid: string;
  oid: string;
  m: number;
  exp: number;
};

function getSecret(): string {
  const s =
    process.env.STATEMENT_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  if (!s) {
    throw new Error(
      "STATEMENT_SECRET / NEXTAUTH_SECRET / SUPABASE_JWT_SECRET tanimsiz."
    );
  }
  return s;
}

function b64urlEncode(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf, "utf-8") : buf;
  return b
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function signStatementToken(p: StatementPayload): string {
  const json = JSON.stringify(p);
  const payload = b64urlEncode(json);
  const sig = crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest();
  return `${payload}.${b64urlEncode(sig)}`;
}

export function verifyStatementToken(token: string): StatementPayload | null {
  try {
    const [payloadB64, sigB64] = token.split(".");
    if (!payloadB64 || !sigB64) return null;
    const expected = b64urlEncode(
      crypto
        .createHmac("sha256", getSecret())
        .update(payloadB64)
        .digest()
    );
    if (
      !crypto.timingSafeEqual(
        Buffer.from(expected),
        Buffer.from(sigB64)
      )
    ) {
      return null;
    }
    const payload = JSON.parse(
      b64urlDecode(payloadB64).toString("utf-8")
    ) as StatementPayload;
    if (!payload?.aid || !payload?.oid || !payload?.m || !payload?.exp) {
      return null;
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
