import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { appsScriptPost } from "@/lib/appsScript"
import { decodeSession, SESSION_COOKIE } from "@/lib/session"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2024-04-10",
})

// Cancels the signed-in member's own membership. The email comes from the signed session
// cookie, not the request body, so nobody can cancel someone else.
export async function POST(req: NextRequest) {
  const session = decodeSession(req.cookies.get(SESSION_COOKIE)?.value)
  if (!session) return NextResponse.json({ result: "unauthorized" }, { status: 401 })

  try {
    // Stop the Stripe subscription renewing. Access continues until the end of the paid period;
    // Stripe then sends customer.subscription.deleted, which marks the member "cancelled".
    if (session.subscriptionId) {
      await stripe.subscriptions.update(session.subscriptionId, { cancel_at_period_end: true })
    }

    const data = await appsScriptPost({ action: "cancel", email: session.email })
    return NextResponse.json(data)
  } catch (err) {
    console.error("Cancel error:", err)
    return NextResponse.json({ result: "error" }, { status: 500 })
  }
}
