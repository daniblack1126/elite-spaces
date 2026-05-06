import { NextRequest, NextResponse } from "next/server"
import { appendRow } from "@/lib/sheets"
import { sendEmail, approvalConfirmationEmail } from "@/lib/email"

export async function POST(req: NextRequest) {
  const { firstName, lastName, email, source, handle } = await req.json()
  if (!firstName || !email) {
    return NextResponse.json({ result: "error", message: "Missing fields" }, { status: 400 })
  }

  const now = new Date()

  await appendRow([
    now,           // A Timestamp
    firstName,     // B First Name
    lastName,      // C Last Name
    email,         // D Email
    source,        // E Source
    handle ?? "",  // F Handle (Instagram/TikTok)
    "pending",     // G Application Status (you fill: pending → approved / rejected)
    "",            // H Member Status (auto-managed)
    null,          // I Stripe Customer ID
    null,          // J Stripe Subscription ID
    null,          // K Plan
    null,          // L Login Token
    null,          // M Token Expiry
    now,           // N Applied At
    null,          // O Approved At
    null,          // P Payment Date
    null,          // Q Next Billing Date
    null,          // R Cancelled At
    null,          // S Notes
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
