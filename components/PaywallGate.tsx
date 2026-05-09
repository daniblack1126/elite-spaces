"use client"

import { useState, useEffect } from "react"
import { colors, fonts, fontSizes, letterSpacing, spacing, anchors, btnDarkFull, MOBILE_BP } from "@/lib/tokens"
import { scrollTo } from "@/lib/utils"
import { PAYWALL_PREVIEW } from "@/lib/events"


interface Props {
  foundingMembersRemaining?: number
  eventCount?: number
}

export default function PaywallGate({
  foundingMembersRemaining = 14,
  eventCount,
}: Props) {
  const [isMobile,     setIsMobile]     = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= MOBILE_BP)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  const rowStyle: React.CSSProperties = {
    display:             "grid",
    gridTemplateColumns: "60px 20px 1fr",
    gap:                 "0 16px",
    padding:             "22px 0",
    borderBottom:        `0.5px solid ${colors.rule}`,
    alignItems:          "start",
  }


  return (
    <section
      id={anchors.paywallGate}
      style={{ background: colors.cream, padding: isMobile ? "0 24px 80px" : spacing.paywallSection }}
    >
      <div style={{ maxWidth: spacing.innerMaxWidth, margin: "0 auto" }}>

        {/* Blurred preview rows */}
        <div style={{ opacity: 0.3, filter: "blur(5px)", pointerEvents: "none", userSelect: "none", borderTop: `0.5px solid ${colors.rule}` }}>
          {PAYWALL_PREVIEW.map((ev) => (
            <div key={ev.date} style={rowStyle}>
              <div>
                <div style={{ fontFamily: fonts.display, fontSize: fontSizes.dateNum, fontWeight: 300, color: colors.ink, lineHeight: 1 }}>{ev.date}</div>
                <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.tag, fontWeight: 300, letterSpacing: letterSpacing.chip, textTransform: "uppercase", color: colors.hint, marginTop: 4 }}>{ev.day}</div>
              </div>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: ev.isFree ? colors.hint : colors.ink, marginTop: 7 }} />
              <div>
                <div style={{ fontFamily: fonts.display, fontSize: fontSizes.eventName, fontWeight: 400, color: colors.ink, marginBottom: 5, lineHeight: 1.3 }}>{ev.name}</div>
                <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.note, fontWeight: 300, color: colors.muted, letterSpacing: letterSpacing.body, marginBottom: 9 }}>{ev.venue}</div>
                <span style={{ fontFamily: fonts.ui, fontSize: fontSizes.tag, fontWeight: 400, letterSpacing: letterSpacing.tags, textTransform: "uppercase", padding: "3px 10px", border: `0.5px solid ${ev.isFree ? colors.muted : colors.ink}`, color: ev.isFree ? colors.muted : colors.ink, borderRadius: 0 }}>{ev.tag}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Paywall card */}
        <div style={{ maxWidth: spacing.paywallCardMax, margin: "0 auto" }}>
          <div style={{ background: colors.cream, border: `0.5px solid ${colors.hint}`, padding: isMobile ? "36px 24px" : "56px 52px", textAlign: "center" }}>

            <div style={{ fontFamily: fonts.display, fontSize: fontSizes.eventName, color: colors.hint, marginBottom: 22, letterSpacing: letterSpacing.subline, textAlign: "center" }}>— ✦ —</div>
            <h3 style={{ fontFamily: fonts.display, fontStyle: "italic", fontSize: fontSizes.paywallHead, fontWeight: 300, color: colors.ink, lineHeight: 1.25, marginBottom: 12, textAlign: "center" }}>
              Your calendar continues.
            </h3>
            <p style={{ fontFamily: fonts.ui, fontSize: fontSizes.sub, fontWeight: 300, lineHeight: 1.85, color: colors.muted, letterSpacing: letterSpacing.signIn, marginBottom: 36 }}>
              {eventCount
                ? `Unlock all ${eventCount} events and monthly updates. Cancel anytime.`
                : "Unlock the full calendar and monthly updates. Cancel anytime."
              }
            </p>

            {/* Pricing preview */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 28 }}>

              {/* Monthly card — invisible badge spacer aligns "Monthly" label top
                  with "Founding Member" label top in the adjacent card */}
              <div style={{ border: `0.5px solid ${colors.rule}`, padding: "22px 16px", textAlign: "center" }}>
                {/* Invisible spacer matching the badge height + margin in the Founding card */}
                <div style={{
                  display:    "inline-block",
                  fontFamily: fonts.ui,
                  fontSize:   fontSizes.micro,
                  fontWeight: 400,
                  letterSpacing: letterSpacing.chip,
                  textTransform: "uppercase",
                  padding:    "3px 10px",
                  marginBottom: 12,
                  visibility: "hidden",
                  border:     "0.5px solid transparent",
                }}>
                  &nbsp;
                </div>
                <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.micro, fontWeight: 400, letterSpacing: letterSpacing.subline, textTransform: "uppercase", color: colors.muted, marginBottom: 10 }}>Monthly</div>
                <div style={{ fontFamily: fonts.display, fontSize: fontSizes.accessHead, fontWeight: 300, color: colors.ink, lineHeight: 1 }}>$8.99</div>
                <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.label, fontWeight: 300, letterSpacing: letterSpacing.period, color: colors.muted, marginTop: 4 }}>per month</div>
              </div>

              {/* Founding Member card */}
              <div style={{ border: `0.5px solid ${colors.ink}`, padding: "22px 16px", textAlign: "center" }}>
                {foundingMembersRemaining > 0 ? (
                  <div style={{ display: "inline-block", fontFamily: fonts.ui, fontSize: fontSizes.micro, fontWeight: 400, letterSpacing: letterSpacing.chip, textTransform: "uppercase", color: colors.ink, border: `0.5px solid ${colors.ink}`, padding: "3px 10px", marginBottom: 12 }}>
                    {foundingMembersRemaining} spots left
                  </div>
                ) : (
                  <div style={{ display: "inline-block", fontFamily: fonts.ui, fontSize: fontSizes.micro, fontWeight: 400, letterSpacing: letterSpacing.chip, textTransform: "uppercase", color: colors.muted, border: `0.5px solid ${colors.muted}`, padding: "3px 10px", marginBottom: 12 }}>Sold out</div>
                )}
                <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.micro, fontWeight: 400, letterSpacing: letterSpacing.subline, textTransform: "uppercase", color: colors.muted, marginBottom: 10 }}>Founding Member</div>
                <div style={{ fontFamily: fonts.display, fontSize: fontSizes.accessHead, fontWeight: 300, color: colors.ink, lineHeight: 1 }}>$86</div>
                <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.label, fontWeight: 300, letterSpacing: letterSpacing.period, color: colors.muted, marginTop: 4 }}>per year</div>
              </div>
            </div>

            <button
              style={btnDarkFull as React.CSSProperties}
              onMouseEnter={(e) => (e.currentTarget.style.background = colors.inkHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = colors.ink)}
              onClick={() => scrollTo(anchors.accessForm)}
            >
              Become a member
            </button>

            <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.note, fontWeight: 300, letterSpacing: letterSpacing.signIn, color: colors.muted, marginTop: 16 }}>
              Already a member?{" "}
              <a
                href="#"
                style={{ color: colors.ink, borderBottom: `0.5px solid ${colors.ink}`, paddingBottom: 1, textDecoration: "none" }}
                onClick={(e) => { e.preventDefault(); scrollTo(anchors.login) }}
              >
                Sign in
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
