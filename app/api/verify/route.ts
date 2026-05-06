import { NextRequest, NextResponse } from "next/server"
import { findRowByEmail, updateCell, COL } from "@/lib/sheets"
import type { Session } from "@/lib/types"

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge:   60 * 60 * 24 * 30, // 30 days
  path:     "/",
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")
  const email = req.nextUrl.searchParams.get("email")?.toLowerCase().trim()

  if (!token || !email) {
    return NextResponse.json({ result: "error" }, { status: 400 })
  }

  const result = await findRowByEmail(email)
  if (!result) return NextResponse.json({ result: "not_found" })

  const storedToken = result.data[COL.loginToken - 1]
  const expiryStr   = result.data[COL.tokenExpiry - 1]

  if (storedToken !== token) {
    return NextResponse.json({ result: "invalid_token" })
  }

  if (!expiryStr || new Date() > new Date(expiryStr)) {
    return NextResponse.json({ result: "token_expired" })
  }

  // Consume the token
  await updateCell(result.row, COL.loginToken, "")
  await updateCell(result.row, COL.tokenExpiry, "")

  const session: Session = {
    firstName:      result.data[COL.firstName - 1],
    email,
    plan:           result.data[COL.plan - 1],
    subscriptionId: result.data[COL.stripeSubscriptionId - 1] ?? "",
  }

  const res = NextResponse.json({ result: "success", ...session })
  res.cookies.set("es_session", JSON.stringify(session), COOKIE_OPTIONS)
  return res
}
