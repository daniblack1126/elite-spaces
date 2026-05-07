// EliteSpaces.tsx — Elite Spaces NYC
// All components in one self-contained file.
// Tokens defined once at the top and shared across all components.
// Framer will surface each named export as a draggable component in Assets.
//
// COMPONENTS:
//   Navigation   — sticky nav, scroll-triggered border, mobile hamburger
//   Hero         — stagger animation, dynamic firstName, scroll-to-form CTA
//   AccessForm   — webhook form, focus states, confirmation message
//   LoginForm    — magic link email login
//   CalendarView — filter chips, event rows, event detail drawer (full when authed)
//   PaywallGate  — blurred preview rows, plan cards, founding member badge
//   MemberFooter — plan info, cancel subscription, sign out
//   Footer       — dark footer, privacy/terms modal overlays
//
// PAGE ANCHORS:
//   hero          → <section id="hero">          Hero
//   access-form   → <section id="access-form">   AccessForm
//   calendar      → <section id="calendar">      CalendarView
//   paywall-gate  → <section id="paywall-gate">  PaywallGate

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence, useInView } from "framer-motion"
import { addPropertyControls, ControlType } from "framer"

// ── CONFIGURATION ────────────────────────────────────────────────────────────
// Update WEBHOOK_URL each time you redeploy your Google Apps Script.

const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbzzzF_E-4OzwJ1KSgAZbJG-pn0TwGQLfSBFnQ49j1yDcir-2cJqRGygWxrgI4SfvPiT-A/exec"

// ── TOKENS ───────────────────────────────────────────────────────────────────

const colors = {
    cream:           "#F7F5F0",
    warmOff:         "#EFEDE7",
    ink:             "#3d2b20",
    inkHover:        "#5a4035",
    body:            "#5a5550",
    muted:           "#6b6560",
    hint:            "#8a8580",
    rule:            "#C8C5BC",
    inkOverlay:      "rgba(61, 43, 32, 0.6)",
    inkOverlayLight: "rgba(61, 43, 32, 0.4)",
}

const fonts = {
    display: "'Merriweather', serif",
    ui:      "'Inter', sans-serif",
}

const fontSizes = {
    micro:       8,
    tag:         9,
    label:       10,
    note:        11,
    sub:         12,
    body:        13,
    wordmark:    14,
    eventName:   16,
    description: 19,
    confirm:     22,
    dateNum:     24,
    paywallHead: 28,
    calTitle:    32,
    accessHead:  34,
    heroHead:    58,
}

const letterSpacing = {
    body:        "0.04em",
    signIn:      "0.06em",
    heroNote:    "0.08em",
    period:      "0.1em",
    footerRight: "0.12em",
    tags:        "0.14em",
    chip:        "0.16em",
    navLink:     "0.18em",
    subline:     "0.2em",
    button:      "0.22em",
    wordmark:    "0.24em",
    eyebrow:     "0.28em",
}

const spacing = {
    pagePadding:       "0 60px",
    pagePaddingMobile: "0 24px",
    sectionY:          "80px",
    accessSectionY:    "88px",
    paywallSection:    "0 60px 100px",
    footerPadding:     "36px 60px",
    innerMaxWidth:     780,
    accessMaxWidth:    960,
    paywallCardMax:    460,
    navHeight:         64,
}

const trans = {
    snap:   "120ms ease",
    fast:   "160ms ease",
    medium: "200ms ease",
}

const anchors = {
    hero:        "hero",
    accessForm:  "access-form",
    calendar:    "calendar",
    paywallGate: "paywall-gate",
}

const MOBILE_BP = 768

// ── SESSION MANAGEMENT ───────────────────────────────────────────────────────

const SESSION_KEY = "elitespaces_session"

function getSession() {
    try {
        const raw = localStorage.getItem(SESSION_KEY)
        return raw ? JSON.parse(raw) : null
    } catch {
        return null
    }
}

function setSession(data: object) {
    try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(data))
    } catch {}
}

function clearSession() {
    try {
        localStorage.removeItem(SESSION_KEY)
    } catch {}
}

// ── SHARED HELPERS ────────────────────────────────────────────────────────────

function scrollTo(id: string) {
    const el = document.getElementById(id)
    if (el) {
        el.scrollIntoView({ behavior: "smooth" })
    } else {
        window.location.hash = id
    }
}

async function postToScript(payload: object) {
    const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    })
    return res
}

async function postToScriptWithResponse(payload: object) {
    const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    })
    return res.json()
}

const btnDark: React.CSSProperties = {
    display: "inline-block",
    background: colors.ink,
    color: colors.cream,
    fontFamily: fonts.ui,
    fontSize: fontSizes.label,
    fontWeight: 400,
    letterSpacing: letterSpacing.button,
    textTransform: "uppercase",
    padding: "15px 40px",
    border: "none",
    borderRadius: 0,
    cursor: "pointer",
    textDecoration: "none",
    transition: `background ${trans.fast}`,
}

const btnDarkFull: React.CSSProperties = {
    ...btnDark,
    display: "block",
    width: "100%",
    textAlign: "center",
    padding: "15px 0",
}

const labelStyle: React.CSSProperties = {
    fontFamily: fonts.ui,
    fontSize: fontSizes.tag,
    fontWeight: 400,
    letterSpacing: letterSpacing.button,
    textTransform: "uppercase",
    color: colors.muted,
    marginBottom: 6,
    display: "block",
}

// ── NAVIGATION ────────────────────────────────────────────────────────────────

export function Navigation(props) {
    const [scrolled, setScrolled] = useState(false)
    const [menuOpen, setMenuOpen] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const [session, setSessionState] = useState(null)

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 60)
        window.addEventListener("scroll", onScroll, { passive: true })
        return () => window.removeEventListener("scroll", onScroll)
    }, [])

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth <= MOBILE_BP)
        check()
        window.addEventListener("resize", check)
        return () => window.removeEventListener("resize", check)
    }, [])

    useEffect(() => {
        setSessionState(getSession())
    }, [])

    const navLinks = session
        ? [
            { label: "My Calendar", id: anchors.calendar },
            { label: "About",       id: null },
          ]
        : [
            { label: "About",      id: null },
            { label: "This Month", id: anchors.calendar },
            { label: "Apply",      id: anchors.accessForm },
          ]

    const navStyle: React.CSSProperties = {
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: scrolled ? colors.cream : "transparent",
        borderBottom: scrolled ? `0.5px solid ${colors.rule}` : "0.5px solid transparent",
        padding: spacing.pagePadding,
        height: spacing.navHeight,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        transition: `background ${trans.medium}, border-color ${trans.medium}`,
        width: "100%",
        fontFamily: fonts.ui,
    }

    const wordmarkStyle: React.CSSProperties = {
        fontFamily: fonts.display,
        fontStyle: "italic",
        fontSize: fontSizes.wordmark,
        fontWeight: 400,
        letterSpacing: letterSpacing.wordmark,
        textTransform: "uppercase",
        color: colors.ink,
        textDecoration: "none",
        cursor: "pointer",
    }

    const linkStyle: React.CSSProperties = {
        fontFamily: fonts.ui,
        fontSize: fontSizes.label,
        fontWeight: 300,
        letterSpacing: letterSpacing.navLink,
        textTransform: "uppercase",
        color: colors.muted,
        textDecoration: "none",
        cursor: "pointer",
        transition: `color ${trans.fast}`,
        background: "none",
        border: "none",
        padding: 0,
    }

    const ctaStyle: React.CSSProperties = {
        fontFamily: fonts.ui,
        fontSize: fontSizes.label,
        fontWeight: 300,
        letterSpacing: letterSpacing.navLink,
        textTransform: "uppercase",
        color: colors.ink,
        borderBottom: `0.5px solid ${colors.ink}`,
        paddingBottom: 1,
        cursor: "pointer",
        textDecoration: "none",
        transition: `color ${trans.fast}, border-color ${trans.fast}`,
    }

    const lineStyle: React.CSSProperties = {
        width: 20,
        height: 0.5,
        background: colors.ink,
    }

    const handleSignOut = () => {
        clearSession()
        setSessionState(null)
        window.location.reload()
    }

    return (
        <>
            <nav style={navStyle}>
                <a
                    style={wordmarkStyle}
                    href={`#${anchors.hero}`}
                    onClick={(e) => { e.preventDefault(); scrollTo(anchors.hero) }}
                >
                    Elite Spaces
                </a>

                {!isMobile && (
                    <div style={{ display: "flex", gap: 40 }}>
                        {navLinks.map(({ label, id }) => (
                            <a
                                key={label}
                                style={linkStyle}
                                href={id ? `#${id}` : "#"}
                                onClick={(e) => { e.preventDefault(); if (id) scrollTo(id) }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = colors.ink)}
                                onMouseLeave={(e) => (e.currentTarget.style.color = colors.muted)}
                            >
                                {label}
                            </a>
                        ))}
                    </div>
                )}

                {isMobile ? (
                    <button
                        style={{ display: "flex", flexDirection: "column", gap: 5, cursor: "pointer", background: "none", border: "none", padding: 4 }}
                        onClick={() => setMenuOpen(true)}
                        aria-label="Open menu"
                    >
                        <div style={lineStyle} />
                        <div style={lineStyle} />
                        <div style={lineStyle} />
                    </button>
                ) : session ? (
                    <a
                        style={ctaStyle}
                        href="#"
                        onClick={(e) => { e.preventDefault(); handleSignOut() }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = colors.muted; e.currentTarget.style.borderColor = colors.muted }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = colors.ink; e.currentTarget.style.borderColor = colors.ink }}
                    >
                        Sign Out
                    </a>
                ) : (
                    <a
                        style={ctaStyle}
                        href={`#${anchors.accessForm}`}
                        onClick={(e) => { e.preventDefault(); scrollTo(anchors.accessForm) }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = colors.muted; e.currentTarget.style.borderColor = colors.muted }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = colors.ink; e.currentTarget.style.borderColor = colors.ink }}
                    >
                        Request Access
                    </a>
                )}
            </nav>

            <AnimatePresence>
                {menuOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ position: "fixed", inset: 0, background: colors.cream, zIndex: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 40 }}
                    >
                        <button onClick={() => setMenuOpen(false)} style={{ position: "absolute", top: 20, right: 24, background: "none", border: "none", fontSize: 24, cursor: "pointer", color: colors.ink }}>✕</button>
                        {navLinks.map(({ label, id }) => (
                            <a
                                key={label}
                                href={id ? `#${id}` : "#"}
                                onClick={() => { if (id) scrollTo(id); setMenuOpen(false) }}
                                style={{ fontFamily: fonts.ui, fontSize: fontSizes.sub, fontWeight: 300, letterSpacing: letterSpacing.wordmark, textTransform: "uppercase", color: colors.ink, textDecoration: "none" }}
                            >
                                {label}
                            </a>
                        ))}
                        {session ? (
                            <a onClick={() => { handleSignOut(); setMenuOpen(false) }} style={{ ...btnDark, cursor: "pointer" }}>Sign Out</a>
                        ) : (
                            <a href={`#${anchors.accessForm}`} onClick={() => { scrollTo(anchors.accessForm); setMenuOpen(false) }} style={{ ...btnDark }}>Request Access</a>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}

addPropertyControls(Navigation, {})

// ── HERO ──────────────────────────────────────────────────────────────────────

export function Hero(props) {
    const [session, setSessionState] = useState(null)

    useEffect(() => {
        // Check for magic link token in URL on page load
        const params = new URLSearchParams(window.location.search)
        const token = params.get("token")
        const email = params.get("email")

        if (token && email) {
            postToScriptWithResponse({ action: "verify", token, email })
                .then((data) => {
                    if (data.result === "success") {
                        setSession({
                            firstName: data.firstName,
                            email: data.email,
                            plan: data.plan,
                            subscriptionId: data.subscriptionId,
                        })
                        setSessionState({
                            firstName: data.firstName,
                            email: data.email,
                            plan: data.plan,
                        })
                        // Clean URL
                        window.history.replaceState({}, "", window.location.pathname)
                    }
                })
                .catch(() => {})
        } else {
            setSessionState(getSession())
        }
    }, [])

    const firstName = session?.firstName || props.firstName || ""
    const displayName = firstName ? firstName : "Your"

    const container = {
        hidden: {},
        show: { transition: { staggerChildren: 0.08 } },
    }

    const item = {
        hidden: { opacity: 0, y: 16 },
        show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
    }

    return (
        <section
            id={anchors.hero}
            style={{ background: colors.cream, padding: "120px 60px 100px", textAlign: "center", fontFamily: fonts.ui }}
        >
            <motion.div variants={container} initial="hidden" animate="show">

                <motion.div variants={item} style={{ fontFamily: fonts.ui, fontSize: fontSizes.label, fontWeight: 300, letterSpacing: letterSpacing.eyebrow, textTransform: "uppercase", color: colors.muted, marginBottom: 36 }}>
                    A private social briefing &nbsp;·&nbsp; New York City
                </motion.div>

                <motion.h1 variants={item} style={{ fontFamily: fonts.display, fontSize: fontSizes.heroHead, lineHeight: 1.08, color: colors.ink, marginBottom: 18 }}>
                    <span style={{ fontStyle: "italic", fontWeight: 300, display: "block" }}>
                        {displayName}{firstName ? "'s" : ""}
                    </span>
                    <span style={{ fontStyle: "normal", fontWeight: 500, display: "block" }}>Calendar</span>
                </motion.h1>

                <motion.div variants={item} style={{ fontFamily: fonts.ui, fontSize: fontSizes.label, fontWeight: 300, letterSpacing: letterSpacing.subline, textTransform: "uppercase", color: colors.hint, marginBottom: 44 }}>
                    May 2026 &nbsp;·&nbsp; Curated for you
                </motion.div>

                <motion.div variants={item} style={{ width: 40, height: 0.5, background: colors.hint, margin: "0 auto 44px" }} />

                <motion.p variants={item} style={{ fontFamily: fonts.display, fontStyle: "italic", fontSize: fontSizes.description, fontWeight: 300, lineHeight: 1.75, color: colors.body, maxWidth: 500, margin: "0 auto 52px" }}>
                    New York has no shortage of events. Elite Spaces finds the ones that are actually worth your time — galas, cultural openings, industry moments, and the hidden free experiences the city keeps to itself. Curated monthly, delivered personally.
                </motion.p>

                <motion.div variants={item}>
                    {session ? (
                        <a
                            style={btnDark}
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
                                style={btnDark}
                                href={`#${anchors.accessForm}`}
                                onClick={(e) => { e.preventDefault(); scrollTo(anchors.accessForm) }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = colors.inkHover)}
                                onMouseLeave={(e) => (e.currentTarget.style.background = colors.ink)}
                            >
                                Request Access
                            </a>
                            <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.note, fontWeight: 300, letterSpacing: letterSpacing.heroNote, color: colors.hint, marginTop: 18 }}>
                                Currently accepting new members &nbsp;·&nbsp; Approval within 1 week
                            </div>
                        </>
                    )}
                </motion.div>

            </motion.div>
        </section>
    )
}

addPropertyControls(Hero, {
    firstName: {
        type: ControlType.String,
        title: "First Name (preview only)",
        defaultValue: "",
        placeholder: "Your",
    },
})

// ── ACCESS FORM ───────────────────────────────────────────────────────────────

export function AccessForm(props) {
    const [submitted, setSubmitted]         = useState(false)
    const [submittedName, setSubmittedName] = useState("")
    const [firstName, setFirstName]         = useState("")
    const [lastName, setLastName]           = useState("")
    const [email, setEmail]                 = useState("")
    const [source, setSource]               = useState("")
    const [focused, setFocused]             = useState("")
    const [loading, setLoading]             = useState(false)

    const ref = useRef(null)
    const isInView = useInView(ref, { once: true, margin: "-15%" })

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        const name = firstName.trim()
        setSubmittedName(name || "you")
        if (WEBHOOK_URL) {
            try {
                await fetch(WEBHOOK_URL, {
                    method: "POST",
                    mode: "no-cors",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ firstName, lastName, email, source }),
                })
            } catch (err) {
                console.error("Webhook error:", err)
            }
        }
        setLoading(false)
        setSubmitted(true)
    }

    const inputStyle = (name: string): React.CSSProperties => ({
        background: colors.cream,
        border: `0.5px solid ${focused === name ? colors.ink : colors.hint}`,
        padding: "13px 16px",
        fontFamily: fonts.ui,
        fontSize: fontSizes.body,
        fontWeight: 300,
        color: colors.ink,
        width: "100%",
        borderRadius: 0,
        outline: "none",
        transition: `border-color ${trans.snap}`,
        appearance: "none" as any,
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
            style={{ background: colors.warmOff, padding: `${spacing.accessSectionY} 60px`, borderTop: `0.5px solid ${colors.rule}`, borderBottom: `0.5px solid ${colors.rule}` }}
        >
            <motion.div
                style={{ maxWidth: spacing.accessMaxWidth, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "start" }}
                initial="hidden"
                animate={isInView ? "show" : "hidden"}
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
                                    <label style={labelStyle}>{f.label}</label>
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
                                <label style={labelStyle}>How did you find us?</label>
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
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                                <button
                                    type="submit"
                                    style={btnDark as React.CSSProperties}
                                    disabled={loading}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = colors.inkHover)}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = colors.ink)}
                                >
                                    {loading ? "Submitting..." : "Submit request"}
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

addPropertyControls(AccessForm, {})

// ── LOGIN FORM ────────────────────────────────────────────────────────────────

export function LoginForm(props) {
    const [email, setEmail]       = useState("")
    const [focused, setFocused]   = useState(false)
    const [status, setStatus]     = useState<"idle" | "loading" | "sent" | "not_found" | "not_member" | "error">("idle")

    const handleLogin = async (e) => {
        e.preventDefault()
        setStatus("loading")
        try {
            const res = await postToScriptWithResponse({ action: "login", email: email.trim() })
            if (res.result === "login_email_sent") {
                setStatus("sent")
            } else if (res.result === "not_found") {
                setStatus("not_found")
            } else if (res.result === "not_member") {
                setStatus("not_member")
            } else {
                setStatus("error")
            }
        } catch {
            // no-cors fallback — assume sent
            setStatus("sent")
        }
    }

    const messages = {
        sent:       { text: "Check your email. Your sign-in link expires in 15 minutes.", color: colors.ink },
        not_found:  { text: "We don't have an application on file for that email. Please request access below.", color: colors.muted },
        not_member: { text: "Your application is still under review. We'll be in touch soon.", color: colors.muted },
        error:      { text: "Something went wrong. Please try again.", color: colors.muted },
    }

    return (
        <section style={{ background: colors.cream, padding: `${spacing.sectionY} 60px`, borderTop: `0.5px solid ${colors.rule}` }}>
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
                            <label style={labelStyle}>Email address</label>
                            <input
                                type="email"
                                placeholder="your@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                onFocus={() => setFocused(true)}
                                onBlur={() => setFocused(false)}
                                required
                                style={{
                                    background: colors.cream,
                                    border: `0.5px solid ${focused ? colors.ink : colors.hint}`,
                                    padding: "13px 16px",
                                    fontFamily: fonts.ui,
                                    fontSize: fontSizes.body,
                                    fontWeight: 300,
                                    color: colors.ink,
                                    width: "100%",
                                    borderRadius: 0,
                                    outline: "none",
                                    transition: `border-color ${trans.snap}`,
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
                            {status === "loading" ? "Sending..." : "Send sign-in link"}
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

addPropertyControls(LoginForm, {})

// ── CALENDAR ROW (private helper) ─────────────────────────────────────────────

function CalRow({ event, index, onClick }) {
    const ref = useRef(null)
    const isInView = useInView(ref, { once: true, margin: "-5%" })
    const [hovered, setHovered] = useState(false)

    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, x: -8 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
            transition={{ duration: 0.4, ease: "easeOut", delay: index * 0.06 }}
            style={{
                display: "grid",
                gridTemplateColumns: "60px 20px 1fr",
                gap: "0 16px",
                padding: hovered ? "22px 8px" : "22px 0",
                margin: hovered ? "0 -8px" : "0",
                borderBottom: `0.5px solid ${colors.rule}`,
                alignItems: "start",
                cursor: "pointer",
                background: hovered ? colors.warmOff : "transparent",
                transition: `background ${trans.snap}, padding ${trans.snap}, margin ${trans.snap}`,
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={onClick}
        >
            <div>
                <div style={{ fontFamily: fonts.display, fontSize: fontSizes.dateNum, fontWeight: 300, color: colors.ink, lineHeight: 1 }}>{event.date}</div>
                <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.tag, fontWeight: 300, letterSpacing: letterSpacing.chip, textTransform: "uppercase", color: colors.hint, marginTop: 4 }}>{event.day}</div>
            </div>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: event.isFree ? colors.hint : colors.ink, marginTop: 7 }} />
            <div>
                <div style={{ fontFamily: fonts.display, fontSize: fontSizes.eventName, fontWeight: 400, color: colors.ink, marginBottom: 5, lineHeight: 1.3 }}>{event.name}</div>
                <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.note, fontWeight: 300, color: colors.muted, letterSpacing: letterSpacing.body, marginBottom: 9 }}>{event.venue} · {event.time}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {event.categories.filter((c) => c !== "free").map((cat) => (
                        <span key={cat} style={{ fontFamily: fonts.ui, fontSize: fontSizes.tag, fontWeight: 400, letterSpacing: letterSpacing.tags, textTransform: "uppercase", padding: "3px 10px", border: `0.5px solid ${colors.ink}`, color: colors.ink, borderRadius: 0 }}>{cat}</span>
                    ))}
                    {event.isFree && (
                        <span style={{ fontFamily: fonts.ui, fontSize: fontSizes.tag, fontWeight: 400, letterSpacing: letterSpacing.tags, textTransform: "uppercase", padding: "3px 10px", border: `0.5px solid ${colors.muted}`, color: colors.muted, borderRadius: 0 }}>Free</span>
                    )}
                </div>
            </div>
        </motion.div>
    )
}

// ── EVENTS DATA ───────────────────────────────────────────────────────────────
// Preview events shown to non-members (first 8)
// Full events shown to authenticated members (all 31)
// Replace with CMS Collection binding in production.

const PREVIEW_EVENTS = [
    { id: 1,  date: 2,  day: "Sat", name: "Vogue Café — Pre-Met Pop-Up",               venue: "Spring St & Sixth Ave, SoHo",           time: "May 2–4, 10AM–5PM",   categories: ["fashion", "popup"], isFree: false },
    { id: 2,  date: 3,  day: "Sun", name: "The People's Ball — Eve of the Met",         venue: "Brooklyn Central Library",              time: "Evening",             categories: ["gala", "free"],    isFree: true  },
    { id: 3,  date: 4,  day: "Mon", name: "The 2026 Met Gala — Fashion Is Art",         venue: "The Metropolitan Museum of Art",        time: "Invitation only",     categories: ["gala", "fashion"], isFree: false },
    { id: 4,  date: 7,  day: "Thu", name: "NYC Ballet Spring Gala — Set in Stone",      venue: "David H. Koch Theater, Lincoln Center", time: "5:30PM",              categories: ["gala", "art"],     isFree: false },
    { id: 5,  date: 8,  day: "Fri", name: "Citi Concert Series — Zara Larsson",         venue: "Rockefeller Plaza",                     time: "Free outdoor concert",categories: ["free"],            isFree: true  },
    { id: 6,  date: 10, day: "Sun", name: "Costume Art Exhibition Opens",               venue: "The Met, Condé M. Nast Galleries",       time: "Opens May 10",        categories: ["art", "fashion"],  isFree: false },
    { id: 7,  date: 14, day: "Thu", name: "Bryant Park Cuban Salsa Festival",           venue: "Bryant Park",                           time: "6PM–10PM",            categories: ["free"],            isFree: true  },
    { id: 8,  date: 16, day: "Sat", name: "Park Avenue Day 2026",                       venue: "Park Avenue, 34th–40th St",             time: "10AM–6PM",            categories: ["free", "art"],     isFree: true  },
]

const FULL_EVENTS = [
    ...PREVIEW_EVENTS,
    { id: 9,  date: 1,  day: "Fri", name: "Made in NYC Week Opens",                    venue: "Citywide — studios, markets, boutiques",time: "May 1–7",             categories: ["popup", "free"],   isFree: true  },
    { id: 10, date: 1,  day: "Fri", name: "Audible Story House Opens",                 venue: "260 Bowery",                            time: "May 1–31, Wed–Sun",   categories: ["art", "free"],     isFree: true  },
    { id: 11, date: 2,  day: "Sat", name: "TikTok Shop Beauty Besties Pop-Up",         venue: "25 Little W 12th St, Meatpacking",      time: "10AM–4PM",            categories: ["beauty", "popup"], isFree: true  },
    { id: 12, date: 2,  day: "Sat", name: "Wella Professionals — The Wella Vault",     venue: "NYC",                                   time: "May 2",               categories: ["beauty", "popup"], isFree: false },
    { id: 13, date: 2,  day: "Sat", name: "Blake Brown Beauty Pop-Up Truck",           venue: "Union Square → SoHo Target",            time: "12PM–5PM",            categories: ["beauty", "popup"], isFree: true  },
    { id: 14, date: 2,  day: "Sat", name: "Vogue Café — Pre-Met Pop-Up",               venue: "Spring St & Sixth Ave, SoHo",           time: "May 2–4, 10AM–5PM",   categories: ["fashion", "popup"], isFree: false },
    { id: 15, date: 4,  day: "Mon", name: "got2b Non-Stop Store",                      venue: "Union Square + roving NYC",             time: "10AM–6PM",            categories: ["beauty", "popup"], isFree: true  },
    { id: 16, date: 7,  day: "Thu", name: "Beauty of Joseon SPF Pop-Up",               venue: "Times Square Plaza",                    time: "May 7–8",             categories: ["beauty", "popup"], isFree: true  },
    { id: 17, date: 9,  day: "Sat", name: "NYC Community Week Opens",                  venue: "100+ venues across all 5 boroughs",     time: "May 9–17",            categories: ["free"],            isFree: true  },
    { id: 18, date: 10, day: "Sun", name: "Macy's Flower Show — Final Day",            venue: "Macy's Herald Square",                  time: "Last day",            categories: ["beauty", "popup"], isFree: false },
    { id: 19, date: 11, day: "Mon", name: "WWD Beauty CEO Summit Opens",               venue: "The Breakers, Palm Beach, FL",          time: "May 11–13",           categories: ["industry"],        isFree: false },
    { id: 20, date: 11, day: "Mon", name: "Spring Waterfront Benefit — The Frying Pan",venue: "The Frying Pan, Hudson River",          time: "7PM–10PM",            categories: ["gala"],            isFree: false },
    { id: 21, date: 12, day: "Tue", name: "MoMA PS1 Annual Benefit",                   venue: "MoMA PS1, Queens",                      time: "7PM cocktails",       categories: ["gala", "art"],     isFree: false },
    { id: 22, date: 12, day: "Tue", name: "Black-Tie Society Benefit",                 venue: "583 Park Avenue",                       time: "5:30PM",              categories: ["gala"],            isFree: false },
    { id: 23, date: 12, day: "Tue", name: "ALO Dance Cardio at Hudson Yards",          venue: "Backyard at Hudson Yards",              time: "Biweekly, Tuesdays",  categories: ["free"],            isFree: true  },
    { id: 24, date: 14, day: "Thu", name: "RetailMediaIQ Pop-Up — VIP Night",          venue: "422 W Broadway, SoHo",                  time: "Invite-only",         categories: ["beauty", "industry"],isFree:false },
    { id: 25, date: 15, day: "Fri", name: "RetailMediaIQ — Consumer Days",             venue: "422 W Broadway, SoHo",                  time: "May 15–17, 11AM–5PM", categories: ["beauty", "popup"], isFree: true  },
    { id: 26, date: 16, day: "Sat", name: "Park Avenue Day 2026",                      venue: "Park Avenue, 34th–40th St",             time: "10AM–6PM",            categories: ["free", "art"],     isFree: true  },
    { id: 27, date: 19, day: "Tue", name: "City Harvest Gala — Shaken, Not Stirred",   venue: "NYC",                                   time: "Evening",             categories: ["gala"],            isFree: false },
    { id: 28, date: 22, day: "Fri", name: "Citi Concert Series — Bleachers",           venue: "Rockefeller Plaza",                     time: "Free outdoor concert",categories: ["free"],            isFree: true  },
    { id: 29, date: 28, day: "Thu", name: "Bryant Park Picnic Performances Opens",     venue: "Bryant Park Lawn",                      time: "7PM",                 categories: ["free", "art"],     isFree: true  },
    { id: 30, date: 29, day: "Fri", name: "Citi Concert Series — Charlie Puth",        venue: "Rockefeller Plaza",                     time: "Free outdoor concert",categories: ["free"],            isFree: true  },
    { id: 31, date: 30, day: "Sat", name: "Carnegie Hall at Hudson Yards — Film Night",venue: "Backyard at Hudson Yards",              time: "Free screening",      categories: ["art", "free"],     isFree: true  },
]

const FILTERS = [
    { key: "all",      label: "All"      },
    { key: "gala",     label: "Galas"    },
    { key: "beauty",   label: "Beauty"   },
    { key: "free",     label: "Free"     },
    { key: "popup",    label: "Pop-ups"  },
    { key: "industry", label: "Industry" },
    { key: "art",      label: "Art"      },
]

function getGreeting() {
    const h = new Date().getHours()
    if (h < 12) return "Good morning"
    if (h < 18) return "Good afternoon"
    return "Good evening"
}

// ── CALENDAR VIEW ─────────────────────────────────────────────────────────────

// Dynamic month label derived from current date
function getCurrentMonthLabel() {
    const d = new Date()
    return d.toLocaleString("en-US", { month: "long", year: "numeric" })
}

export function CalendarView(props) {
    const { isAuthenticated = false } = props
    const [activeFilter, setActiveFilter] = useState("all")
    const [drawerEvent, setDrawerEvent]   = useState(null)
    const [greeting]                      = useState(getGreeting)
    const [session, setSessionState]      = useState(null)
    const [fetchedEvents, setFetchedEvents] = useState(null) // null = not yet loaded

    useEffect(() => {
        setSessionState(getSession())
    }, [])

    // Fetch live events from the Google Apps Script (action: getEvents).
    // Falls back to hardcoded PREVIEW_EVENTS / FULL_EVENTS arrays while loading
    // or if the Apps Script hasn't been updated yet.
    useEffect(() => {
        postToScriptWithResponse({ action: "getEvents" })
            .then((data) => {
                if (data && Array.isArray(data.events) && data.events.length > 0) {
                    setFetchedEvents(data.events)
                } else {
                    setFetchedEvents([]) // loaded but empty — will fall back
                }
            })
            .catch(() => {
                setFetchedEvents([]) // fetch failed — fall back to hardcoded
            })
    }, [])

    const authed = isAuthenticated || !!session
    const firstName = session?.firstName || props.firstName || ""

    // Use fetched events once loaded; fall back to hardcoded arrays until then
    const liveEvents = fetchedEvents !== null && fetchedEvents.length > 0
        ? fetchedEvents
        : null
    const events = liveEvents
        ? (authed ? liveEvents : liveEvents.slice(0, 8))
        : (authed ? FULL_EVENTS : PREVIEW_EVENTS)

    const filtered = activeFilter === "all"
        ? events
        : events.filter((e) => e.categories.includes(activeFilter))

    const chipStyle = (active: boolean): React.CSSProperties => ({
        fontFamily: fonts.ui,
        fontSize: fontSizes.tag,
        fontWeight: 400,
        letterSpacing: letterSpacing.chip,
        textTransform: "uppercase",
        padding: "7px 16px",
        border: `0.5px solid ${active ? colors.ink : colors.rule}`,
        color: active ? colors.ink : colors.muted,
        cursor: "pointer",
        borderRadius: 0,
        background: "transparent",
        transition: `border-color ${trans.snap}, color ${trans.snap}`,
    })

    return (
        <section
            id={anchors.calendar}
            style={{ background: colors.cream, padding: `${spacing.sectionY} 60px` }}
        >
            <div style={{ maxWidth: spacing.innerMaxWidth, margin: "0 auto" }}>

                {/* Header */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 44 }}>
                    <div>
                        <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.label, fontWeight: 300, letterSpacing: letterSpacing.subline, textTransform: "uppercase", color: colors.muted, marginBottom: 7 }}>
                            {greeting}
                        </div>
                        <div style={{ fontFamily: fonts.display, fontStyle: "italic", fontSize: fontSizes.calTitle, fontWeight: 300, color: colors.ink }}>
                            {firstName ? `${firstName}'s Calendar` : "Your Calendar"}
                        </div>
                    </div>
                    <div>
                        <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.label, fontWeight: 300, letterSpacing: letterSpacing.subline, textTransform: "uppercase", color: colors.hint, marginBottom: 12, textAlign: "right" }}>
                            {getCurrentMonthLabel()}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            {FILTERS.map((f) => (
                                <button
                                    key={f.key}
                                    style={chipStyle(activeFilter === f.key)}
                                    onClick={() => setActiveFilter(f.key)}
                                    onMouseEnter={(e) => { if (activeFilter !== f.key) { e.currentTarget.style.borderColor = colors.ink; e.currentTarget.style.color = colors.ink } }}
                                    onMouseLeave={(e) => { if (activeFilter !== f.key) { e.currentTarget.style.borderColor = colors.rule; e.currentTarget.style.color = colors.muted } }}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Rows */}
                <div style={{ borderTop: `0.5px solid ${colors.rule}` }}>
                    {filtered.map((event, index) => (
                        <CalRow key={event.id} event={event} index={index} onClick={() => setDrawerEvent(event)} />
                    ))}
                </div>

                {/* More events — only shown to non-members */}
                {!authed && (
                    <div
                        onClick={() => scrollTo(anchors.paywallGate)}
                        onMouseEnter={(e) => (e.currentTarget.style.color = colors.ink)}
                        onMouseLeave={(e) => (e.currentTarget.style.color = colors.hint)}
                        style={{ textAlign: "center", padding: "32px 0 8px", fontFamily: fonts.ui, fontSize: fontSizes.label, fontWeight: 300, letterSpacing: letterSpacing.subline, textTransform: "uppercase", color: colors.hint, cursor: "pointer", transition: `color ${trans.fast}` }}
                    >
                        — {Math.max(0, (liveEvents || FULL_EVENTS).length - 8)} more events this month —
                    </div>
                )}
            </div>

            {/* Event Drawer */}
            <AnimatePresence>
                {drawerEvent && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} exit={{ opacity: 0 }}
                            style={{ position: "fixed", inset: 0, background: colors.ink, zIndex: 90 }}
                            onClick={() => setDrawerEvent(null)}
                        />
                        <motion.div
                            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
                            transition={{ type: "spring", damping: 28, stiffness: 300 }}
                            style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 400, background: colors.cream, zIndex: 91, padding: 48, display: "flex", flexDirection: "column", gap: 20 }}
                        >
                            <button onClick={() => setDrawerEvent(null)} style={{ position: "absolute", top: 20, right: 20, background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.ink }}>✕</button>
                            <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.tag, fontWeight: 300, letterSpacing: letterSpacing.subline, textTransform: "uppercase", color: colors.hint }}>
                                May {drawerEvent.date}, 2026 · {drawerEvent.day}
                            </div>
                            <div style={{ fontFamily: fonts.display, fontSize: fontSizes.confirm, fontWeight: 400, color: colors.ink, lineHeight: 1.3 }}>
                                {drawerEvent.name}
                            </div>
                            <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.sub, fontWeight: 300, color: colors.muted, letterSpacing: letterSpacing.body }}>
                                {drawerEvent.venue}
                            </div>
                            <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.note, fontWeight: 300, color: colors.hint, letterSpacing: letterSpacing.signIn }}>
                                {drawerEvent.time}
                            </div>
                            {drawerEvent.description && (
                                <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.body, fontWeight: 300, color: colors.body, letterSpacing: letterSpacing.body, lineHeight: 1.75, marginTop: 4 }}>
                                    {drawerEvent.description}
                                </div>
                            )}
                            <a
                                href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(drawerEvent.name)}&details=${encodeURIComponent(drawerEvent.description || drawerEvent.venue)}&location=${encodeURIComponent(drawerEvent.venue)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ fontFamily: fonts.ui, fontSize: fontSizes.label, fontWeight: 400, letterSpacing: letterSpacing.button, textTransform: "uppercase", color: colors.ink, borderBottom: `0.5px solid ${colors.ink}`, paddingBottom: 1, textDecoration: "none", display: "inline-block", marginTop: 12 }}
                            >
                                Add to Google Calendar
                            </a>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </section>
    )
}

addPropertyControls(CalendarView, {
    isAuthenticated: {
        type: ControlType.Boolean,
        title: "Authenticated (preview)",
        defaultValue: false,
        enabledTitle: "Show full calendar",
        disabledTitle: "Show preview only",
    },
    firstName: {
        type: ControlType.String,
        title: "First Name (preview only)",
        defaultValue: "",
        placeholder: "Your",
    },
})

// ── PAYWALL GATE ──────────────────────────────────────────────────────────────

const PAYWALL_PREVIEW = [
    { date: 19, day: "Tue", name: "City Harvest Gala — Shaken, Not Stirred", venue: "NYC · Evening",                            tag: "Gala", isFree: false },
    { date: 22, day: "Fri", name: "Citi Concert Series — Bleachers",          venue: "Rockefeller Plaza · Free outdoor concert", tag: "Free", isFree: true  },
]

export function PaywallGate(props) {
    const { foundingMembersRemaining = 14 } = props
    const [selectedPlan, setSelectedPlan] = useState("founding")
    const [session, setSessionState]      = useState(null)

    useEffect(() => {
        setSessionState(getSession())
    }, [])

    // Hide paywall for authenticated members
    if (session) return null

    const planCardStyle = (featured: boolean, selected: boolean): React.CSSProperties => ({
        border: `0.5px solid ${featured || selected ? colors.ink : colors.rule}`,
        padding: "22px 16px",
        textAlign: "center",
        cursor: "pointer",
        transition: `border-color ${trans.snap}`,
        background: selected ? colors.warmOff : "transparent",
    })

    const rowStyle: React.CSSProperties = {
        display: "grid",
        gridTemplateColumns: "60px 20px 1fr",
        gap: "0 16px",
        padding: "22px 0",
        borderBottom: `0.5px solid ${colors.rule}`,
        alignItems: "start",
    }

    return (
        <section
            id={anchors.paywallGate}
            style={{ background: colors.cream, padding: spacing.paywallSection }}
        >
            <div style={{ maxWidth: spacing.innerMaxWidth, margin: "0 auto" }}>

                {/* Blurred rows */}
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

                {/* Card */}
                <div style={{ maxWidth: spacing.paywallCardMax, margin: "0 auto" }}>
                    <div style={{ background: colors.cream, border: `0.5px solid ${colors.hint}`, padding: "56px 52px", textAlign: "center" }}>

                        <div style={{ fontFamily: fonts.display, fontSize: fontSizes.eventName, color: colors.hint, marginBottom: 22, letterSpacing: letterSpacing.subline }}>— ✦ —</div>
                        <h3 style={{ fontFamily: fonts.display, fontStyle: "italic", fontSize: fontSizes.paywallHead, fontWeight: 300, color: colors.ink, lineHeight: 1.25, marginBottom: 12 }}>
                            Your calendar continues.
                        </h3>
                        <p style={{ fontFamily: fonts.ui, fontSize: fontSizes.sub, fontWeight: 300, lineHeight: 1.85, color: colors.muted, letterSpacing: letterSpacing.signIn, marginBottom: 36 }}>
                            Unlock all 31 events and monthly updates. Cancel anytime.
                        </p>

                        {/* Plans */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 28 }}>
                            <div style={planCardStyle(false, selectedPlan === "monthly")} onClick={() => setSelectedPlan("monthly")}>
                                <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.micro, fontWeight: 400, letterSpacing: letterSpacing.subline, textTransform: "uppercase", color: colors.muted, marginBottom: 10 }}>Monthly</div>
                                <div style={{ fontFamily: fonts.display, fontSize: fontSizes.accessHead, fontWeight: 300, color: colors.ink, lineHeight: 1 }}>$12</div>
                                <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.label, fontWeight: 300, letterSpacing: letterSpacing.period, color: colors.muted, marginTop: 4, marginBottom: 14 }}>per month</div>
                                <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.label, fontWeight: 300, lineHeight: 1.9, color: colors.muted }}>Full calendar<br />Cancel anytime</div>
                            </div>
                            <div style={planCardStyle(true, selectedPlan === "founding")} onClick={() => setSelectedPlan("founding")}>
                                {foundingMembersRemaining > 0 ? (
                                    <div style={{ display: "inline-block", fontFamily: fonts.ui, fontSize: fontSizes.micro, fontWeight: 400, letterSpacing: letterSpacing.chip, textTransform: "uppercase", color: colors.ink, border: `0.5px solid ${colors.ink}`, padding: "3px 10px", marginBottom: 12 }}>
                                        {foundingMembersRemaining} spots left
                                    </div>
                                ) : (
                                    <div style={{ display: "inline-block", fontFamily: fonts.ui, fontSize: fontSizes.micro, fontWeight: 400, letterSpacing: letterSpacing.chip, textTransform: "uppercase", color: colors.muted, border: `0.5px solid ${colors.muted}`, padding: "3px 10px", marginBottom: 12 }}>Sold out</div>
                                )}
                                <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.micro, fontWeight: 400, letterSpacing: letterSpacing.subline, textTransform: "uppercase", color: colors.muted, marginBottom: 10 }}>Founding Member</div>
                                <div style={{ fontFamily: fonts.display, fontSize: fontSizes.accessHead, fontWeight: 300, color: colors.ink, lineHeight: 1 }}>$99</div>
                                <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.label, fontWeight: 300, letterSpacing: letterSpacing.period, color: colors.muted, marginTop: 4, marginBottom: 14 }}>per year</div>
                                <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.label, fontWeight: 300, lineHeight: 1.9, color: colors.muted }}>Full calendar<br />Locked-in rate forever</div>
                            </div>
                        </div>

                        <button
                            style={btnDarkFull as React.CSSProperties}
                            onMouseEnter={(e) => (e.currentTarget.style.background = colors.inkHover)}
                            onMouseLeave={(e) => (e.currentTarget.style.background = colors.ink)}
                            onClick={() => {
                                // FRAMER: Replace with Stripe Payment Link navigation
                                // Monthly: window.location.href = STRIPE_MONTHLY_LINK
                                // Founding: window.location.href = STRIPE_FOUNDING_LINK
                                console.log("Open Stripe payment for plan:", selectedPlan)
                            }}
                        >
                            Become a member
                        </button>

                        <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.note, fontWeight: 300, letterSpacing: letterSpacing.signIn, color: colors.muted, marginTop: 16 }}>
                            Already a member?{" "}
                            <a href="#" style={{ color: colors.ink, borderBottom: `0.5px solid ${colors.ink}`, paddingBottom: 1, textDecoration: "none" }} onClick={(e) => { e.preventDefault(); scrollTo("login") }}>
                                Sign in
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

addPropertyControls(PaywallGate, {
    foundingMembersRemaining: {
        type: ControlType.Number,
        title: "Founding Spots Left",
        defaultValue: 14,
        min: 0,
        step: 1,
    },
})

// ── MEMBER FOOTER ─────────────────────────────────────────────────────────────
// Shown only to authenticated members, above the main Footer.
// Displays plan info and cancel / sign-out options.

export function MemberFooter(props) {
    const [session, setSessionState]           = useState(null)
    const [cancelState, setCancelState]        = useState<"idle" | "confirm" | "loading" | "done">("idle")

    useEffect(() => {
        setSessionState(getSession())
    }, [])

    if (!session) return null

    const planLabel = session.plan === "founding" ? "Founding Member · Annual" : "Monthly Member"

    const handleCancel = async () => {
        if (cancelState === "idle") {
            setCancelState("confirm")
            return
        }
        setCancelState("loading")
        try {
            await postToScript({ action: "cancel", email: session.email })
        } catch {}
        setCancelState("done")
    }

    const handleSignOut = () => {
        clearSession()
        window.location.reload()
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
                                {cancelState === "loading" ? "Cancelling..." : cancelState === "confirm" ? "Confirm cancellation" : "Cancel subscription"}
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
                        onClick={handleSignOut}
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

addPropertyControls(MemberFooter, {})

// ── FOOTER ────────────────────────────────────────────────────────────────────

const PRIVACY_TEXT = `Elite Spaces NYC collects only the information you voluntarily provide when requesting access or becoming a member — your name, email address, and how you found us.

We use your information to process your membership application, send your monthly calendar briefing, and communicate account-related updates.

We do not sell, rent, or share your personal information with third parties for marketing purposes. We do not run advertising on this platform.

Data is stored securely. You may request deletion of your account at any time by emailing hello@elitespaces.nyc.

Last updated May 2026.`

const TERMS_TEXT = `By creating an account or requesting access, you agree to the following:

1. Elite Spaces NYC provides a curated monthly events briefing for members in New York City.
2. Membership fees are non-refundable after the current billing period begins, except where required by law.
3. Founding Member rates are locked for life as long as your membership remains active.
4. You may not share, redistribute, or resell access to calendar content.
5. We reserve the right to revoke membership for misuse of the platform.

For questions, contact hello@elitespaces.nyc.

Last updated May 2026.`

export function Footer(props) {
    const [modal, setModal] = useState<null | "privacy" | "terms">(null)

    const footerLinkStyle: React.CSSProperties = {
        color: colors.muted,
        textDecoration: "none",
        cursor: "pointer",
        transition: `color ${trans.fast}`,
    }

    return (
        <>
            <footer style={{ background: colors.ink, padding: spacing.footerPadding, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontFamily: fonts.display, fontStyle: "italic", fontSize: fontSizes.wordmark, fontWeight: 400, letterSpacing: letterSpacing.wordmark, textTransform: "uppercase", color: colors.cream }}>
                    Elite Spaces
                </div>
                <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.label, fontWeight: 300, letterSpacing: letterSpacing.chip, textTransform: "uppercase", color: colors.muted, display: "flex", gap: 28 }}>
                    <span>New York City</span>
                    <span>Private membership</span>
                    <span>Est. 2026</span>
                </div>
                <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.label, fontWeight: 300, letterSpacing: letterSpacing.footerRight, color: colors.muted, textAlign: "right" }}>
                    elitespaces.nyc<br />
                    <a style={footerLinkStyle} href="#" onClick={(e) => { e.preventDefault(); setModal("privacy") }} onMouseEnter={(e) => (e.currentTarget.style.color = colors.cream)} onMouseLeave={(e) => (e.currentTarget.style.color = colors.muted)}>Privacy</a>
                    {" · "}
                    <a style={footerLinkStyle} href="#" onClick={(e) => { e.preventDefault(); setModal("terms") }} onMouseEnter={(e) => (e.currentTarget.style.color = colors.cream)} onMouseLeave={(e) => (e.currentTarget.style.color = colors.muted)}>Terms</a>
                </div>
            </footer>

            <AnimatePresence>
                {modal && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ position: "fixed", inset: 0, background: colors.inkOverlay, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}
                        onClick={() => setModal(null)}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                            transition={{ duration: 0.25, ease: "easeOut" }}
                            style={{ background: colors.cream, maxWidth: 560, width: "100%", maxHeight: "80vh", overflowY: "auto", padding: "48px 52px", position: "relative" }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button onClick={() => setModal(null)} style={{ position: "absolute", top: 16, right: 20, background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.ink }}>✕</button>
                            <div style={{ fontFamily: fonts.display, fontStyle: "italic", fontSize: fontSizes.dateNum, fontWeight: 300, color: colors.ink, marginBottom: 28, lineHeight: 1.2 }}>
                                {modal === "privacy" ? "Privacy Policy" : "Terms of Service"}
                            </div>
                            <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.body, fontWeight: 300, lineHeight: 1.9, color: colors.body, letterSpacing: letterSpacing.body, whiteSpace: "pre-wrap" }}>
                                {modal === "privacy" ? PRIVACY_TEXT : TERMS_TEXT}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}

addPropertyControls(Footer, {})
