import { NextRequest, NextResponse } from "next/server"
import { findRowByEmail, updateCell, COL } from "@/lib/sheets"
import { sendEmail, paymentEmail } from "@/lib/email"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const secret = searchParams.get("secret")
  const email  = searchParams.get("email")?.toLowerCase().trim()

  if (secret !== process.env.BYPASS_SECRET) {
    return NextResponse.json({ result: "unauthorized" }, { status: 401 })
  }

  if (!email) {
    return NextResponse.json({ result: "error", message: "email required" }, { status: 400 })
  }

  const result = await findRowByEmail(email)
  if (!result) {
    return NextResponse.json({ result: "email_not_found", message: "No application found for that email." }, { status: 404 })
  }

  await updateCell(result.row, COL.applicationStatus, "approved")
  await updateCell(result.row, COL.memberStatus,       "payment_pending")
  await updateCell(result.row, COL.approvedAt,         new Date().toISOString())

  const firstName = result.data[COL.firstName - 1]
  await sendEmail(
    email,
    "Your Elite Spaces access is approved",
    paymentEmail(firstName, email),
  )

  return NextResponse.json({ result: "success", email })
}
