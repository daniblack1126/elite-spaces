import { NextRequest, NextResponse } from "next/server"
import { findRowByEmail, updateCell, COL } from "@/lib/sheets"
import { sendEmail, welcomeEmail } from "@/lib/email"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const secret = searchParams.get("secret")
  const email  = searchParams.get("email")?.toLowerCase().trim()
  const plan   = (searchParams.get("plan") ?? "monthly") as "monthly" | "founding"

  if (secret !== process.env.BYPASS_SECRET) {
    return NextResponse.json({ result: "unauthorized" }, { status: 401 })
  }

  if (!email) {
    return NextResponse.json({ result: "error", message: "email required" }, { status: 400 })
  }

  const result = await findRowByEmail(email)
  if (!result) {
    return NextResponse.json({
      result:  "email_not_found",
      message: "No application found. Add the person to the sheet first.",
    })
  }

  const status = plan === "founding" ? "founding_member" : "monthly_member"
  await updateCell(result.row, COL.status,      status)
  await updateCell(result.row, COL.plan,        plan)
  await updateCell(result.row, COL.paymentDate, new Date().toISOString())
  await updateCell(result.row, COL.notes,       "Manual bypass — no payment")

  const firstName = result.data[COL.firstName - 1]
  await sendEmail(email, "Welcome to Elite Spaces", welcomeEmail(firstName))

  return NextResponse.json({ result: "success", status, email })
}
