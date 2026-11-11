import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { appsScriptPost } from "@/lib/appsScript"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
})


function planFromPaymentLink(paymentLinkId: string | null): "founding" | "monthly" {
  const foundingId = (process.env.STRIPE_FOUNDING_LINK ?? "").split("/").pop()
  return paymentLinkId && foundingId && paymentLinkId === foundingId
    ? "founding"
    : "monthly"
}

// Stripe events are verified here (signature check), then passed to the Apps Script,
// which updates the Members sheet and sends the welcome / payment-failed emails.
async function callAppsScript(body: Record<string, unknown>) {
  try {
    const res = await appsScriptPost(body)
    if ((res as { result?: string }).result !== "success") console.error("Apps Script did not apply Stripe event:", body, res)
  } catch (err) {
    console.error("Apps Script call failed for Stripe event:", body, err)
  }
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
    const session = event.data.object as Stripe.Checkout.Session
    const email   = (session.customer_details?.email ?? session.customer_email ?? "").toLowerCase()
    const plan    = planFromPaymentLink(session.payment_link as string | null)

    await callAppsScript({
      action:         "stripe_webhook",
      event:          "checkout_completed",
      email,
      customerId:     session.customer as string,
      subscriptionId: session.subscription as string,
      plan,
    })
  }

  if (event.type === "customer.subscription.deleted") {
    const sub      = event.data.object as Stripe.Subscription
    const customer = await stripe.customers.retrieve(sub.customer as string) as Stripe.Customer
    const email    = (customer.email ?? "").toLowerCase()

    await callAppsScript({
      action: "stripe_webhook",
      event:  "subscription_cancelled",
      email,
    })
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice
    const email   = (invoice.customer_email ?? "").toLowerCase()

    await callAppsScript({
      action: "stripe_webhook",
      event:  "payment_failed",
      email,
    })
  }

  return NextResponse.json({ received: true })
}
