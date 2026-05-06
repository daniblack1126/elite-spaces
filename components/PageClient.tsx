"use client"

import { useState } from "react"
import Navigation from "./Navigation"
import Hero from "./Hero"
import AccessForm from "./AccessForm"
import LoginForm from "./LoginForm"
import CalendarView from "./CalendarView"
import PaywallGate from "./PaywallGate"
import MemberFooter from "./MemberFooter"
import Footer from "./Footer"
import type { Session } from "@/lib/types"

interface Props {
  initialSession:    Session | null
  stripeMonthlyLink: string
  stripeFoundingLink: string
}

export default function PageClient({
  initialSession,
  stripeMonthlyLink,
  stripeFoundingLink,
}: Props) {
  const [session, setSession] = useState<Session | null>(initialSession)

  const handleSignOut = async () => {
    await fetch("/api/signout", { method: "POST" })
    setSession(null)
    window.location.reload()
  }

  return (
    <>
      <Navigation session={session} onSignOut={handleSignOut} />
      <Hero session={session} onSessionChange={setSession} />
      {!session && <AccessForm />}
      {!session && <LoginForm />}
      <CalendarView session={session} />
      {!session && (
        <PaywallGate
          stripeMonthlyLink={stripeMonthlyLink}
          stripeFoundingLink={stripeFoundingLink}
        />
      )}
      {session && <MemberFooter session={session} onSignOut={handleSignOut} />}
      <Footer />
    </>
  )
}
