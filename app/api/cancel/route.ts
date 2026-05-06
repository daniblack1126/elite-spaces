import { NextRequest, NextResponse } from "next/server"
import { findRowByEmail, updateCell, COL } from "@/lib/sheets"
import { sendEmail, cancellationEmail } from "@/lib/email"

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ result: "error" }, { status: 400 })

  const emailLower = (email as string).toLowerCase().trim()
  const result = await findRowByEmail(emailLower)
  if (!result) return NextResponse.json({ result: "not_found" }, { status: 404 })

  await updateCell(result.row, COL.status, "cancelling")
  await updateCell(result.row, COL.cancelledAt, new Date().toISOString())

  const firstName = result.data[COL.firstName - 1]
  await sendEmail(
    emailLower,
    "Cancellation confirmed — Elite Spaces",
    cancellationEmail(firstName),
  )

  return NextResponse.json({ result: "cancellation_received" })
}
