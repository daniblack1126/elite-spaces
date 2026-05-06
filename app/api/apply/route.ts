import { NextRequest, NextResponse } from "next/server"
import { appendRow } from "@/lib/sheets"
import { sendEmail, approvalConfirmationEmail } from "@/lib/email"

export async function POST(req: NextRequest) {
  const { firstName, lastName, email, source } = await req.json()
  if (!firstName || !email) {
    return NextResponse.json({ result: "error", message: "Missing fields" }, { status: 400 })
  }

  const now = new Date()

  await appendRow([
    now,        // A Timestamp
    firstName,  // B First Name
    lastName,   // C Last Name
    email,      // D Email
    source,     // E Source
    "pending",  // F Status
    null,       // G Stripe Customer ID
    null,       // H Stripe Subscription ID
    null,       // I Plan
    null,       // J Login Token
    null,       // K Token Expiry
    now,        // L Applied At
    null,       // M Approved At
    null,       // N Payment Date
    null,       // O Next Billing Date
    null,       // P Cancelled At
    null,       // Q Notes
  ])

  await sendEmail(
    email,
    "You're on the list — Elite Spaces",
    approvalConfirmationEmail(firstName),
  )

  await sendEmail(
    process.env.ADMIN_EMAIL ?? "",
    `New Elite Spaces application — ${firstName} ${lastName}`,
    `New application:\n\nName: ${firstName} ${lastName}\nEmail: ${email}\nSource: ${source}\nTime: ${now.toISOString()}\n\nSet status to "approved" in the sheet to trigger the payment email.`,
  )

  return NextResponse.json({ result: "success" })
}
