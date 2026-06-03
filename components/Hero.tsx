"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { colors, fonts, fontSizes, letterSpacing, trans, anchors, btnDark, MOBILE_BP } from "@/lib/tokens"
import { scrollTo } from "@/lib/utils"
import type { Session } from "@/lib/types"
import { scrollTo, getCurrentMonthYear } from "@/lib/utils"

interface Props {
  session:         Session | null
  onSessionChange: (s: Session) => void
}

export default function Hero({ session, onSessionChange }: Props) {
  const [verifying, setVerifying] = useState(false)
  const [isMobile,  setIsMobile]  = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= MOBILE_BP)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  useEffect(() => {
    // Hash-based magic link: https://domain.com#token=TOKEN&email=EMAIL
    const hash   = window.location.hash.replace("#", "")
    const params = new URLSearchParams(hash)
    const token  = params.get("token")
    const email  = params.get("email")

    if (!token || !email) return

    // Clean the hash immediately so a refresh doesn't re-trigger
    window.history.replaceState({}, "", window.location.pathname)

    setVerifying(true)
    fetch(`/api/verify?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.result === "success") {
          onSessionChange({
            firstName:      data.firstName,
            email:          data.email,
            plan:           data.plan,
            subscriptionId: data.subscriptionId,
          })
          // Reload so the server component re-reads the cookie and passes the
          // fresh session down — this also scrolls to top cleanly.
          window.location.reload()
        }
      })
      .catch(() => {})
      .finally(() => setVerifying(false))
  }, [onSessionChange])

  const firstName  = session?.firstName ?? ""
  const displayName = firstName || "Your"

  const container = {
    hidden: {},
    show:   { transition: { staggerChildren: 0.08 } },
  }

  const item = {
    hidden: { opacity: 0, y: 16 },
    show:   { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
  }

  return (
    <section
      id={anchors.hero}
      style={{ background: colors.cream, padding: isMobile ? "48px 24px 36px" : "56px 60px 40px", textAlign: "center", fontFamily: fonts.ui }}
    >
      {verifying && (
        <div style={{ position: "fixed", inset: 0, background: colors.cream, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: fonts.ui, fontSize: fontSizes.label, letterSpacing: letterSpacing.button, textTransform: "uppercase", color: colors.muted }}>
          Signing you in…
        </div>
      )}

      <motion.div variants={container} initial="hidden" animate="show">

        <motion.div
          variants={item}
          style={{ fontFamily: fonts.ui, fontSize: fontSizes.label, fontWeight: 300, letterSpacing: letterSpacing.eyebrow, textTransform: "uppercase", color: colors.muted, marginBottom: 20 }}
        >
          A private social briefing &nbsp;·&nbsp; New York City
        </motion.div>

        <motion.h1
          variants={item}
          style={{ fontFamily: fonts.display, fontSize: isMobile ? 34 : fontSizes.heroHead, lineHeight: 1.08, color: colors.ink, marginBottom: 12, textAlign: "center" }}
        >
          <span style={{ fontStyle: "italic", fontWeight: 300, display: "block" }}>
            {displayName}{firstName ? "'s" : ""}
          </span>
          <span style={{ fontStyle: "normal", fontWeight: 500, display: "block" }}>Calendar</span>
        </motion.h1>

        <motion.div
          variants={item}
          style={{ fontFamily: fonts.ui, fontSize: fontSizes.label, fontWeight: 300, letterSpacing: letterSpacing.subline, textTransform: "uppercase", color: colors.hint, marginBottom: 28 }}
        >
          {getCurrentMonthYear()} &nbsp;·&nbsp; Curated for you
        </motion.div>

        <motion.div
          variants={item}
          style={{ width: 40, height: 0.5, background: colors.hint, margin: "0 auto 28px" }}
        />

        <motion.p
          variants={item}
          style={{ fontFamily: fonts.display, fontStyle: "italic", fontSize: fontSizes.description, fontWeight: 300, lineHeight: 1.7, color: colors.body, maxWidth: 520, margin: "0 auto 32px" }}
        >
          Everyone asks how you always know about the best events. This is how. Galas, cultural openings, industry moments, and the hidden gems the city keeps to itself — curated monthly, delivered personally.
        </motion.p>

        <motion.div variants={item}>
          {session ? (
            <a
              style={btnDark as React.CSSProperties}
              href={`#${anchors.calendar}`}
              onClick={(e) => { e.preventDefault(); scrollTo(anchors.calendar) }}
              onMouseEnter={(e) => (e.currentTarget.style.background = colors.inkHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = colors.ink)}
            >
              View My Calendar
            </a>
          ) : (
            <>
              <a
                style={btnDark as React.CSSProperties}
                href={`#${anchors.accessForm}`}
                onClick={(e) => { e.preventDefault(); scrollTo(anchors.accessForm) }}
                onMouseEnter={(e) => (e.currentTarget.style.background = colors.inkHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = colors.ink)}
              >
                Request Access
              </a>
              <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.note, fontWeight: 300, letterSpacing: letterSpacing.heroNote, color: colors.hint, marginTop: 12 }}>
                Only 14 spots remaining this month
              </div>
            </>
          )}
        </motion.div>

      </motion.div>
    </section>
  )
}
