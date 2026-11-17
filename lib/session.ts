import { createHmac, timingSafeEqual } from "crypto"
import type { Session } from "@/lib/types"

// The member session cookie is signed, so nobody can hand-write a cookie
// and see the full calendar without logging in.
// Uses SESSION_SECRET; falls back to STRIPE_SECRET_KEY (also server-only) until SESSION_SECRET is added.

export const SESSION_COOKIE = "es_session"

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge:   60 * 60 * 24 * 30, // 30 days
  path:     "/",
}

function key(): string {
  const k = process.env.SESSION_SECRET || process.env.STRIPE_SECRET_KEY
  if (!k) throw new Error("SESSION_SECRET is not set")
  return k
}

function sign(payload: string): string {
  return createHmac("sha256", key()).update(payload).digest("base64url")
}

export function encodeSession(session: Session): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url")
  return `${payload}.${sign(payload)}`
}

export function decodeSession(raw: string | undefined): Session | null {
  if (!raw) return null
  const [payload, sig] = raw.split(".")
  if (!payload || !sig) return null
  try {
    const expected = Buffer.from(sign(payload))
    const given    = Buffer.from(sig)
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
    const s = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
    return s && typeof s.email === "string" ? (s as Session) : null
  } catch {
    return null
  }
}
