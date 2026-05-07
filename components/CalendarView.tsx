"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence, useInView } from "framer-motion"
import { colors, fonts, fontSizes, letterSpacing, spacing, trans, anchors, MOBILE_BP } from "@/lib/tokens"
import { getGreeting, scrollTo } from "@/lib/utils"
import { PREVIEW_EVENTS, FULL_EVENTS, FILTERS, CALENDAR_MONTH, CALENDAR_YEAR, type Event } from "@/lib/events"
import type { Session } from "@/lib/types"

function CalRow({ event, index, onClick }: { event: Event; index: number; onClick: () => void }) {
  const ref     = useRef(null)
  const inView  = useInView(ref, { once: true, margin: "-5%" })
  const [hovered, setHovered] = useState(false)

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -8 }}
      animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
      transition={{ duration: 0.4, ease: "easeOut", delay: index * 0.06 }}
      style={{
        display:             "grid",
        gridTemplateColumns: "60px 20px 1fr",
        gap:                 "0 16px",
        padding:             hovered ? "22px 8px" : "22px 0",
        margin:              hovered ? "0 -8px"   : "0",
        borderBottom:        `0.5px solid ${colors.rule}`,
        alignItems:          "start",
        cursor:              "pointer",
        background:          hovered ? colors.warmOff : "transparent",
        transition:          `background ${trans.snap}, padding ${trans.snap}, margin ${trans.snap}`,
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

interface Props {
  session: Session | null
}

export default function CalendarView({ session }: Props) {
  const [activeFilter, setActiveFilter] = useState("all")
  const [drawerEvent,  setDrawerEvent]  = useState<Event | null>(null)
  const [isMobile,     setIsMobile]     = useState(false)
  const greeting = getGreeting()

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= MOBILE_BP)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  const calDate    = new Date(CALENDAR_YEAR, CALENDAR_MONTH, 1)
  const monthLabel = calDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  const monthName  = calDate.toLocaleDateString("en-US", { month: "long" })
  const currentYear = CALENDAR_YEAR

  const events   = session ? FULL_EVENTS : PREVIEW_EVENTS
  const filtered = (activeFilter === "all"
    ? events
    : events.filter((e) => e.categories.includes(activeFilter))
  ).sort((a, b) => a.date - b.date)

  const chipStyle = (active: boolean): React.CSSProperties => ({
    fontFamily:    fonts.ui,
    fontSize:      fontSizes.tag,
    fontWeight:    400,
    letterSpacing: letterSpacing.chip,
    textTransform: "uppercase",
    padding:       "7px 16px",
    border:        `0.5px solid ${active ? colors.ink : colors.rule}`,
    color:         active ? colors.ink : colors.muted,
    cursor:        "pointer",
    borderRadius:  0,
    background:    "transparent",
    transition:    `border-color ${trans.snap}, color ${trans.snap}`,
  })

  return (
    <section
      id={anchors.calendar}
      style={{ background: colors.cream, padding: isMobile ? `${spacing.sectionY} 24px` : `${spacing.sectionY} 60px` }}
    >
      <div style={{ maxWidth: spacing.innerMaxWidth, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "flex-start", justifyContent: "space-between", gap: isMobile ? 20 : 0, marginBottom: 44 }}>
          <div>
            <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.label, fontWeight: 300, letterSpacing: letterSpacing.subline, textTransform: "uppercase", color: colors.muted, marginBottom: 7 }}>
              {greeting}
            </div>
            <div style={{ fontFamily: fonts.display, fontStyle: "italic", fontSize: fontSizes.calTitle, fontWeight: 300, color: colors.ink }}>
              {session?.firstName ? `${session.firstName}'s Calendar` : "Your Calendar"}
            </div>
          </div>
          <div>
            <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.label, fontWeight: 300, letterSpacing: letterSpacing.subline, textTransform: "uppercase", color: colors.hint, marginBottom: 12, textAlign: "right" }}>
              {monthLabel}
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

        {/* Paywall nudge for non-members */}
        {!session && (
          <div
            onClick={() => scrollTo(anchors.paywallGate)}
            onMouseEnter={(e) => (e.currentTarget.style.color = colors.ink)}
            onMouseLeave={(e) => (e.currentTarget.style.color = colors.hint)}
            style={{ textAlign: "center", padding: "32px 0 8px", fontFamily: fonts.ui, fontSize: fontSizes.label, fontWeight: 300, letterSpacing: letterSpacing.subline, textTransform: "uppercase", color: colors.hint, cursor: "pointer", transition: `color ${trans.fast}` }}
          >
            — 23 more events this month —
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
              style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: isMobile ? "100vw" : 400, background: colors.cream, zIndex: 91, padding: isMobile ? 32 : 48, display: "flex", flexDirection: "column", gap: 20 }}
            >
              <button onClick={() => setDrawerEvent(null)} style={{ position: "absolute", top: 20, right: 20, background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.ink }}>✕</button>
              <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.tag, fontWeight: 300, letterSpacing: letterSpacing.subline, textTransform: "uppercase", color: colors.hint }}>
                {monthName} {drawerEvent.date}, {currentYear} · {drawerEvent.day}
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
              <a
                href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(drawerEvent.name)}&details=${encodeURIComponent(drawerEvent.venue)}`}
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
