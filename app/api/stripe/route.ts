import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { findRowByEmail, updateCell, COL } from "@/lib/sheets"
import { sendEmail, welcomeEmail, paymentFailedEmail } from "@/lib/email"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
})

// Derive Stripe payment link IDs from the full URLs so we can detect which plan was purchased.
function planFromPaymentLink(paymentLinkId: string | null): "founding" | "monthly" {
  const foundingId = (process.env.STRIPE_FOUNDING_LINK ?? "").split("/").pop()
  return paymentLinkId && foundingId && paymentLinkId === foundingId
    ? "founding"
    : "monthly"
}

export async function POST(req: NextRequest) {
  const sig     = req.headers.get("stripe-signature")
  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig!,
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  if (event.type === "checkout.session.completed") {
    const session    = event.data.object as Stripe.Checkout.Session
    const email      = (session.customer_details?.email ?? session.customer_email ?? "").toLowerCase()
    const customerId = session.customer as string
    const subId      = session.subscription as string
    const plan       = planFromPaymentLink(session.payment_link as string | null)

    const result = await findRowByEmail(email)
    if (result) {
      const status = plan === "founding" ? "founding_member" : "monthly_member"
      await updateCell(result.row, COL.status,               status)
      await updateCell(result.row, COL.stripeCustomerId,     customerId ?? "")
      await updateCell(result.row, COL.stripeSubscriptionId, subId ?? "")
      await updateCell(result.row, COL.plan,                 plan)
      await updateCell(result.row, COL.paymentDate,          new Date().toISOString())

      const firstName = result.data[COL.firstName - 1]
      await sendEmail(email, "Welcome to Elite Spaces", welcomeEmail(firstName))
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub      = event.data.object as Stripe.Subscription
    const customer = await stripe.customers.retrieve(sub.customer as string) as Stripe.Customer
    const email    = (customer.email ?? "").toLowerCase()

    const result = await findRowByEmail(email)
    if (result) {
      await updateCell(result.row, COL.status,      "cancelled")
      await updateCell(result.row, COL.cancelledAt, new Date().toISOString())
    }
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice
    const email   = (invoice.customer_email ?? "").toLowerCase()

    const result = await findRowByEmail(email)
    if (result) {
      await updateCell(result.row, COL.status, "payment_failed")
      const firstName = result.data[COL.firstName - 1]
      await sendEmail(email, "Payment issue — Elite Spaces", paymentFailedEmail(firstName))
    }
  }

  return NextResponse.json({ received: true })
}
