import { cookies } from "next/headers"
import PageClient from "@/components/PageClient"
import { decodeSession, SESSION_COOKIE } from "@/lib/session"

export default function Page() {
  const cookieStore = cookies()
  const session = decodeSession(cookieStore.get(SESSION_COOKIE)?.value)

  const stripeMonthlyLink = process.env.STRIPE_MONTHLY_LINK ?? ""
  const stripeFoundingLink = process.env.STRIPE_FOUNDING_LINK ?? ""

  return (
    <PageClient
      initialSession={session}
      stripeMonthlyLink={stripeMonthlyLink}
      stripeFoundingLink={stripeFoundingLink}
    />
  )
}
