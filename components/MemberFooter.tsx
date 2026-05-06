"use client"

import { useState } from "react"
import { colors, fonts, fontSizes, letterSpacing, spacing, trans } from "@/lib/tokens"
import type { Session } from "@/lib/types"

type CancelState = "idle" | "confirm" | "loading" | "done"

interface Props {
  session:   Session
  onSignOut: () => void
}

export default function MemberFooter({ session, onSignOut }: Props) {
  const [cancelState, setCancelState] = useState<CancelState>("idle")

  const planLabel =
    session.plan === "founding" ? "Founding Member · Annual" : "Monthly Member"

  const handleCancel = async () => {
    if (cancelState === "idle") {
      setCancelState("confirm")
      return
    }
    setCancelState("loading")
    try {
      await fetch("/api/cancel", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: session.email }),
      })
    } catch {
      // best-effort
    }
    setCancelState("done")
  }

  return (
    <section style={{ background: colors.warmOff, padding: "48px 60px", borderTop: `0.5px solid ${colors.rule}` }}>
      <div style={{ maxWidth: spacing.innerMaxWidth, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 24 }}>

        <div>
          <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.tag, fontWeight: 300, letterSpacing: letterSpacing.chip, textTransform: "uppercase", color: colors.hint, marginBottom: 6 }}>
            Your membership
          </div>
          <div style={{ fontFamily: fonts.display, fontStyle: "italic", fontSize: fontSizes.eventName, fontWeight: 300, color: colors.ink }}>
            {session.firstName} &nbsp;·&nbsp; {planLabel}
          </div>
          <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.note, fontWeight: 300, color: colors.muted, letterSpacing: letterSpacing.body, marginTop: 4 }}>
            {session.email}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }}>
          {cancelState === "done" ? (
            <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.note, fontWeight: 300, color: colors.muted, letterSpacing: letterSpacing.body }}>
              Cancellation received. You'll retain access until the end of your billing period.
            </div>
          ) : (
            <>
              <button
                onClick={handleCancel}
                style={{ fontFamily: fonts.ui, fontSize: fontSizes.label, fontWeight: 300, letterSpacing: letterSpacing.navLink, textTransform: "uppercase", color: cancelState === "confirm" ? colors.ink : colors.muted, background: "none", border: "none", cursor: "pointer", padding: 0, transition: `color ${trans.fast}`, textDecoration: cancelState === "confirm" ? "underline" : "none" }}
              >
                {cancelState === "loading" ? "Cancelling…" : cancelState === "confirm" ? "Confirm cancellation" : "Cancel subscription"}
              </button>
              {cancelState === "confirm" && (
                <button
                  onClick={() => setCancelState("idle")}
                  style={{ fontFamily: fonts.ui, fontSize: fontSizes.label, fontWeight: 300, letterSpacing: letterSpacing.navLink, textTransform: "uppercase", color: colors.hint, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  Keep my membership
                </button>
              )}
            </>
          )}
          <button
            onClick={onSignOut}
            style={{ fontFamily: fonts.ui, fontSize: fontSizes.label, fontWeight: 300, letterSpacing: letterSpacing.navLink, textTransform: "uppercase", color: colors.muted, background: "none", border: "none", cursor: "pointer", padding: 0, transition: `color ${trans.fast}` }}
            onMouseEnter={(e) => (e.currentTarget.style.color = colors.ink)}
            onMouseLeave={(e) => (e.currentTarget.style.color = colors.muted)}
          >
            Sign out
          </button>
        </div>
      </div>
    </section>
  )
}
