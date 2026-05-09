"use client"

import { useState, useEffect } from "react"
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
  const [session,    setSession]    = useState<Session | null>(initialSession)
  const [eventCount, setEventCount] = useState<number | undefined>(undefined)

  useEffect(() => {
    fetch("/api/events")
      .then((r) => r.json())
      .then((data) => {
        const count = Array.isArray(data?.events) ? data.events.length : undefined
        setEventCount(count)
      })
      .catch(() => {})
  }, [])

  const handleSignOut = async () => {
    await fetch("/api/signout", { method: "POST" })
    setSession(null)
    window.location.reload()
  }

  return (
    <>
      <Navigation session={session} onSignOut={handleSignOut} />
      <Hero session={session} onSessionChange={setSession} />
      <CalendarView session={session} eventCount={eventCount} />
      {!session && <PaywallGate eventCount={eventCount} />}
      {!session && <AccessForm />}
      {!session && <LoginForm />}
      {session && <MemberFooter session={session} onSignOut={handleSignOut} />}
      <Footer />
    </>
  )
}
