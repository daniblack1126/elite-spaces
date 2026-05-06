import { cookies } from "next/headers"
import PageClient from "@/components/PageClient"
import type { Session } from "@/lib/types"

export default function Page() {
  const cookieStore = cookies()
  const raw = cookieStore.get("es_session")?.value
  let session: Session | null = null
  if (raw) {
    try {
      session = JSON.parse(raw)
    } catch {
      // malformed cookie — ignore
    }
  }

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
