"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { colors, fonts, fontSizes, letterSpacing, spacing, trans, anchors, btnDarkFull, labelStyle } from "@/lib/tokens"
import { scrollTo } from "@/lib/utils"

type Status = "idle" | "loading" | "sent" | "not_found" | "not_member" | "error"

const messages: Record<string, { text: string; color: string }> = {
  sent:       { text: "Check your email. Your sign-in link expires in 15 minutes.", color: colors.ink },
  not_found:  { text: "We don't have an application on file for that email. Please request access below.", color: colors.muted },
  not_member: { text: "Your application is still under review. We'll be in touch soon.", color: colors.muted },
  error:      { text: "Something went wrong. Please try again.", color: colors.muted },
}

export default function LoginForm() {
  const [email,   setEmail]   = useState("")
  const [focused, setFocused] = useState(false)
  const [status,  setStatus]  = useState<Status>("idle")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus("loading")
    try {
      const res  = await fetch(`/api/login?email=${encodeURIComponent(email.trim())}`)
      const data = await res.json()
      if      (data.result === "login_email_sent") setStatus("sent")
      else if (data.result === "not_found")         setStatus("not_found")
      else if (data.result === "not_member")        setStatus("not_member")
      else                                          setStatus("error")
    } catch {
      setStatus("error")
    }
  }

  return (
    <section
      id={anchors.login}
      style={{ background: colors.cream, padding: `${spacing.sectionY} 60px`, borderTop: `0.5px solid ${colors.rule}` }}
    >
      <div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center" }}>

        <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.label, fontWeight: 300, letterSpacing: letterSpacing.eyebrow, textTransform: "uppercase", color: colors.muted, marginBottom: 28 }}>
          Member sign in
        </div>

        <h2 style={{ fontFamily: fonts.display, fontStyle: "italic", fontSize: fontSizes.accessHead, fontWeight: 300, color: colors.ink, lineHeight: 1.2, marginBottom: 12 }}>
          Welcome back.
        </h2>

        <p style={{ fontFamily: fonts.ui, fontSize: fontSizes.body, fontWeight: 300, lineHeight: 1.9, color: colors.body, letterSpacing: letterSpacing.body, marginBottom: 40 }}>
          Enter your email and we'll send you a sign-in link. No password needed.
        </p>

        {status === "sent" ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ fontFamily: fonts.display, fontStyle: "italic", fontSize: fontSizes.confirm, fontWeight: 300, color: colors.ink, lineHeight: 1.5 }}
          >
            Check your inbox.
          </motion.div>
        ) : (
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", textAlign: "left" }}>
              <label style={labelStyle as React.CSSProperties}>Email address</label>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                required
                style={{
                  background:   colors.cream,
                  border:       `0.5px solid ${focused ? colors.ink : colors.hint}`,
                  padding:      "13px 16px",
                  fontFamily:   fonts.ui,
                  fontSize:     fontSizes.body,
                  fontWeight:   300,
                  color:        colors.ink,
                  width:        "100%",
                  borderRadius: 0,
                  outline:      "none",
                  transition:   `border-color ${trans.snap}`,
                }}
              />
            </div>

            {status !== "idle" && status !== "loading" && messages[status] && (
              <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.note, fontWeight: 300, color: messages[status].color, letterSpacing: letterSpacing.body, textAlign: "left" }}>
                {messages[status].text}
              </div>
            )}

            <button
              type="submit"
              style={btnDarkFull as React.CSSProperties}
              disabled={status === "loading"}
              onMouseEnter={(e) => (e.currentTarget.style.background = colors.inkHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = colors.ink)}
            >
              {status === "loading" ? "Sending…" : "Send sign-in link"}
            </button>

            <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.note, fontWeight: 300, color: colors.hint, letterSpacing: letterSpacing.body }}>
              Not a member?{" "}
              <a
                href={`#${anchors.accessForm}`}
                onClick={(e) => { e.preventDefault(); scrollTo(anchors.accessForm) }}
                style={{ color: colors.ink, borderBottom: `0.5px solid ${colors.ink}`, paddingBottom: 1, textDecoration: "none" }}
              >
                Request access
              </a>
            </div>
          </form>
        )}
      </div>
    </section>
  )
}
