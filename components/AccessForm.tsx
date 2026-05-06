"use client"

import { useState, useRef, useEffect } from "react"
import { motion, useInView } from "framer-motion"
import { colors, fonts, fontSizes, letterSpacing, spacing, trans, anchors, btnDark, labelStyle, MOBILE_BP } from "@/lib/tokens"

export default function AccessForm() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= MOBILE_BP)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  const [submitted,     setSubmitted]     = useState(false)
  const [submittedName, setSubmittedName] = useState("")
  const [firstName,     setFirstName]     = useState("")
  const [lastName,      setLastName]      = useState("")
  const [email,         setEmail]         = useState("")
  const [source,        setSource]        = useState("")
  const [handle,        setHandle]        = useState("")
  const [focused,       setFocused]       = useState("")
  const [loading,       setLoading]       = useState(false)

  const ref     = useRef(null)
  const inView  = useInView(ref, { once: true, margin: "-15%" })

  const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyMbeDg4LeMcKnSl4gwGHa-8E2Zke92ti5jMNvogXfAp387gNl3gG9cPa90SLIoUXA/exec"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const name = firstName.trim()
    setSubmittedName(name || "you")
    try {
      await fetch(APPS_SCRIPT_URL, {
        method:  "POST",
        mode:    "no-cors",
        headers: { "Content-Type": "text/plain" },
        body:    JSON.stringify({ firstName, lastName, email, source, handle }),
      })
    } catch (err) {
      console.error("Apply error:", err)
    }
    setLoading(false)
    setSubmitted(true)
  }

  const inputStyle = (name: string): React.CSSProperties => ({
    background:  colors.cream,
    border:      `0.5px solid ${focused === name ? colors.ink : colors.hint}`,
    padding:     "13px 16px",
    fontFamily:  fonts.ui,
    fontSize:    fontSizes.body,
    fontWeight:  300,
    color:       colors.ink,
    width:       "100%",
    borderRadius: 0,
    outline:     "none",
    transition:  `border-color ${trans.snap}`,
    appearance:  "none",
  })

  const fields = [
    { name: "firstName", label: "Your first name", type: "text",  placeholder: "First name",    value: firstName, setter: setFirstName, required: true  },
    { name: "lastName",  label: "Your last name",  type: "text",  placeholder: "Last name",      value: lastName,  setter: setLastName,  required: false },
    { name: "email",     label: "Email address",   type: "email", placeholder: "your@email.com", value: email,     setter: setEmail,     required: true  },
  ]

  const fadeIn     = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } } }
  const fadeInLate = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut", delay: 0.1 } } }

  return (
    <section
      id={anchors.accessForm}
      ref={ref}
      style={{ background: colors.warmOff, padding: isMobile ? `${spacing.accessSectionY} 24px` : `${spacing.accessSectionY} 60px`, borderTop: `0.5px solid ${colors.rule}`, borderBottom: `0.5px solid ${colors.rule}` }}
    >
      <motion.div
        style={{ maxWidth: spacing.accessMaxWidth, margin: "0 auto", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 40 : 80, alignItems: "start" }}
        initial="hidden"
        animate={inView ? "show" : "hidden"}
      >
        <motion.div variants={fadeIn}>
          <h2 style={{ fontFamily: fonts.display, fontStyle: "italic", fontSize: fontSizes.accessHead, fontWeight: 300, color: colors.ink, lineHeight: 1.2, marginBottom: 18 }}>
            Join the<br />inner circle.
          </h2>
          <p style={{ fontFamily: fonts.ui, fontSize: fontSizes.body, fontWeight: 300, lineHeight: 1.9, color: colors.body, letterSpacing: letterSpacing.body, marginBottom: 36 }}>
            Elite Spaces is a curated monthly briefing for those who move through New York with intention. We review each application before sending your personal access link.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              "— Sourced from hundreds of publications monthly",
              "— Updated the first Sunday of each month",
              "— No advertising. Ever.",
            ].map((line, i) => (
              <div key={i} style={{ fontFamily: fonts.ui, fontSize: fontSizes.label, fontWeight: 300, letterSpacing: letterSpacing.chip, textTransform: "uppercase", color: colors.hint }}>
                {line}
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div variants={fadeInLate}>
          {submitted ? (
            <div style={{ fontFamily: fonts.display, fontStyle: "italic", fontSize: fontSizes.confirm, fontWeight: 300, color: colors.ink, lineHeight: 1.5 }}>
              Thank you, {submittedName}.<br />We'll be in touch within 1 week.
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {fields.map((f) => (
                <div key={f.name} style={{ display: "flex", flexDirection: "column" }}>
                  <label style={labelStyle as React.CSSProperties}>{f.label}</label>
                  <input
                    style={inputStyle(f.name)}
                    type={f.type}
                    placeholder={f.placeholder}
                    value={f.value}
                    onChange={(e) => f.setter(e.target.value)}
                    onFocus={() => setFocused(f.name)}
                    onBlur={() => setFocused("")}
                    required={f.required}
                  />
                </div>
              ))}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <label style={labelStyle as React.CSSProperties}>How did you find us?</label>
                <select
                  style={{ ...inputStyle("source"), color: source ? colors.ink : colors.hint, backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23C8C5BC' stroke-width='0.5'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 16px center", cursor: "pointer" }}
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  onFocus={() => setFocused("source")}
                  onBlur={() => setFocused("")}
                >
                  <option value="" disabled>Select one</option>
                  <option value="tiktok">TikTok</option>
                  <option value="friend">A friend or referral</option>
                  <option value="google">Google search</option>
                  <option value="instagram">Instagram</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <label style={labelStyle as React.CSSProperties}>What&apos;s your handle? (Instagram / TikTok)</label>
                <input
                  style={inputStyle("handle")}
                  type="text"
                  placeholder="@yourhandle"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  onFocus={() => setFocused("handle")}
                  onBlur={() => setFocused("")}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                <button
                  type="submit"
                  style={btnDark as React.CSSProperties}
                  disabled={loading}
                  onMouseEnter={(e) => (e.currentTarget.style.background = colors.inkHover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = colors.ink)}
                >
                  {loading ? "Submitting…" : "Submit request"}
                </button>
                <span style={{ fontFamily: fonts.ui, fontSize: fontSizes.label, fontWeight: 300, letterSpacing: letterSpacing.heroNote, color: colors.hint }}>
                  No card required
                </span>
              </div>
            </form>
          )}
        </motion.div>
      </motion.div>
    </section>
  )
}
