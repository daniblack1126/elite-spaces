import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { findRowByEmail, updateCell, COL } from "@/lib/sheets"
import { sendEmail, loginEmail } from "@/lib/email"

const VALID_STATUSES = ["monthly_member", "founding_member"]

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email")?.toLowerCase().trim()
  if (!email) return NextResponse.json({ result: "error" }, { status: 400 })

  const result = await findRowByEmail(email)
  if (!result) return NextResponse.json({ result: "not_found" })

  const status = result.data[COL.status - 1]
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ result: "not_member", status })
  }

  const token  = crypto.randomBytes(32).toString("hex")
  const expiry = new Date(Date.now() + 15 * 60 * 1000)

  await updateCell(result.row, COL.loginToken, token)
  await updateCell(result.row, COL.tokenExpiry, expiry.toISOString())

  const firstName = result.data[COL.firstName - 1]
  const siteUrl   = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  const loginUrl  = `${siteUrl}#token=${token}&email=${encodeURIComponent(email)}`

  await sendEmail(
    email,
    "Your Elite Spaces sign-in link",
    loginEmail(firstName, loginUrl),
  )

  return NextResponse.json({ result: "login_email_sent" })
}
