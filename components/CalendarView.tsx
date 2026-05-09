"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence, useInView } from "framer-motion"
import { colors, fonts, fontSizes, letterSpacing, spacing, trans, anchors, MOBILE_BP } from "@/lib/tokens"
import { getGreeting, scrollTo } from "@/lib/utils"
import { FILTERS, CALENDAR_MONTH, CALENDAR_YEAR, type Event } from "@/lib/events"
import type { Session } from "@/lib/types"

// ── ICS DOWNLOAD ──────────────────────────────────────────────────────────────

function downloadICS(event: Event) {
  const monthNum = CALENDAR_MONTH + 1
  const monthPad = String(monthNum).padStart(2, "0")
  const datePad  = String(event.date).padStart(2, "0")
  const dateStr  = `${CALENDAR_YEAR}${monthPad}${datePad}`
  const nextDate = String(event.date + 1).padStart(2, "0")
  const nextStr  = `${CALENDAR_YEAR}${monthPad}${nextDate}`

  const safeDesc = (event.description || event.venue)
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")

  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Elite Spaces NYC//Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `SUMMARY:${event.name}`,
    `DTSTART;VALUE=DATE:${dateStr}`,
    `DTEND;VALUE=DATE:${nextStr}`,
    `LOCATION:${event.venue}`,
    `DESCRIPTION:${safeDesc} | Time: ${event.time}`,
    `UID:elitespaces-${event.id}-${dateStr}@elitespaces.nyc`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]

  const blob = new Blob([icsLines.join("\r\n")], { type: "text/calendar;charset=utf-8" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href     = url
  a.download = `${event.name.replace(/[^a-z0-9]/gi, "_")}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── API EVENT MAPPING ─────────────────────────────────────────────────────────

const PREVIEW_COUNT = 5

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
]
const DAY_ABBREVS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]

function parseDateField(dateStr: string): { date: number; day: string } {
  // handles "May 9, 2026", "May 9-10, 2026", "May 14-20, 2026", "June 27-28, 2026"
  const match = dateStr.match(/([A-Za-z]+)\s+(\d+)/)
  if (!match) return { date: 1, day: "?" }
  const monthIdx = MONTH_NAMES.findIndex((m) =>
    m.toLowerCase().startsWith(match[1].toLowerCase())
  )
  const dayNum = parseInt(match[2], 10)
  const d = new Date(CALENDAR_YEAR, monthIdx >= 0 ? monthIdx : CALENDAR_MONTH, dayNum)
  return { date: dayNum, day: DAY_ABBREVS[d.getDay()] }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapApiEvent(raw: any, index: number): Event {
  const { date, day } = parseDateField(raw["Date"] || "")
  const catStr: string = raw["Categories"] || ""
  const categories = catStr.split(",").map((c) => c.trim()).filter(Boolean)
  const isFree = raw["isFree"] === "true" || raw["isFree"] === true
  return {
    id:          index + 100,           // offset avoids collision with any static ids
    date,
    day,
    name:        raw["Event Name"]  || "",
    venue:       raw["Location"]    || "",
    time:        raw["Time"]        || "",
    categories,
    isFree,
    description: raw["Description"] || "",
  }
}

// ── CALENDAR ROW ──────────────────────────────────────────────────────────────

function CalRow({ event, index, onClick }: { event: Event; index: number; onClick: () => void }) {
  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-5%" })
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

// ── CALENDAR VIEW ─────────────────────────────────────────────────────────────

interface Props {
  session: Session | null
}

export default function CalendarView({ session }: Props) {
  const [activeFilter, setActiveFilter] = useState("all")
  const [drawerEvent,  setDrawerEvent]  = useState<Event | null>(null)
  const [isMobile,     setIsMobile]     = useState(false)
  const [allEvents,    setAllEvents]    = useState<Event[]>([])
  const [eventsLoaded, setEventsLoaded] = useState(false)
  const greeting = getGreeting()

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= MOBILE_BP)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  // Fetch events from the Google Sheet via the server-side proxy
  useEffect(() => {
    fetch("/api/events")
      .then((r) => r.json())
      .then((data) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw: any[] = Array.isArray(data?.events) ? data.events : []
        const mapped = raw
          // only show Published events
          .filter((e) => !e["Status"] || e["Status"] === "Published")
          .map(mapApiEvent)
          .sort((a, b) => a.date - b.date)
        setAllEvents(mapped)
        setEventsLoaded(true)
      })
      .catch(() => setEventsLoaded(true))
  }, [])

  const calDate    = new Date(CALENDAR_YEAR, CALENDAR_MONTH, 1)
  const monthLabel = calDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  const monthName  = calDate.toLocaleDateString("en-US", { month: "long" })

  const visibleEvents = session ? allEvents : allEvents.slice(0, PREVIEW_COUNT)
  const moreCount     = Math.max(0, allEvents.length - PREVIEW_COUNT)
  const filtered = (activeFilter === "all"
    ? visibleEvents
    : visibleEvents.filter((e) => e.categories.includes(activeFilter))
  ).sort((a, b) => a.date - b.date)

  const chipStyle = (active: boolean): React.CSSProperties => ({
    fontFamily:    fonts.ui,
    fontSize:      fontSizes.tag,
    fontWeight:    400,
    letterSpacing: letterSpacing.chip,
    textTransform: "uppercase",
    padding:       "7px 12px",
    border:        `0.5px solid ${active ? colors.ink : colors.rule}`,
    color:         active ? colors.ink : colors.muted,
    cursor:        "pointer",
    borderRadius:  0,
    background:    "transparent",
    transition:    `border-color ${trans.snap}, color ${trans.snap}`,
    boxSizing:     "border-box" as const,
    display:       "block",
    textAlign:     "center" as const,
    whiteSpace:    "nowrap" as const,
  })

  // Google Calendar URL
  const gcalUrl = (ev: Event) => {
    const monthNum = CALENDAR_MONTH + 1
    const m = String(monthNum).padStart(2, "0")
    const d = String(ev.date).padStart(2, "0")
    const d2 = String(ev.date + 1).padStart(2, "0")
    const start = `${CALENDAR_YEAR}${m}${d}`
    const end   = `${CALENDAR_YEAR}${m}${d2}`
    const details = encodeURIComponent(`${ev.description || ev.venue}\n\nTime: ${ev.time}`)
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(ev.name)}&dates=${start}/${end}&details=${details}&location=${encodeURIComponent(ev.venue)}`
  }

  const calLinkStyle: React.CSSProperties = {
    fontFamily:     fonts.ui,
    fontSize:       fontSizes.label,
    fontWeight:     400,
    letterSpacing:  letterSpacing.button,
    textTransform:  "uppercase",
    color:          colors.ink,
    borderBottom:   `0.5px solid ${colors.ink}`,
    paddingBottom:  1,
    textDecoration: "none",
    display:        "inline-block",
    cursor:         "pointer",
  }

  return (
    <section
      id={anchors.calendar}
      style={{ background: colors.cream, padding: isMobile ? `${spacing.sectionY} 24px` : `${spacing.sectionY} 60px` }}
    >
      <div style={{ maxWidth: spacing.innerMaxWidth, margin: "0 auto" }}>

        {/* Header */}
        <div style={{
          display:        "flex",
          flexDirection:  isMobile ? "column" : "row",
          alignItems:     "flex-start",
          justifyContent: "space-between",
          gap:            isMobile ? 20 : 0,
          marginBottom:   44,
        }}>
          <div>
            <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.label, fontWeight: 300, letterSpacing: letterSpacing.subline, textTransform: "uppercase", color: colors.muted, marginBottom: 7 }}>
              {greeting}
            </div>
            <div style={{ fontFamily: fonts.display, fontStyle: "italic", fontSize: fontSizes.calTitle, fontWeight: 300, color: colors.ink }}>
              {session?.firstName ? `${session.firstName}'s Calendar` : "Your Calendar"}
            </div>
          </div>

          <div style={{ width: isMobile ? "100%" : "auto" }}>
            <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.label, fontWeight: 300, letterSpacing: letterSpacing.subline, textTransform: "uppercase", color: colors.hint, marginBottom: 12, textAlign: isMobile ? "left" : "right" }}>
              {monthLabel}
            </div>

            {/* ── Mobile filter layout: 4 top, 3 bottom ── */}
            {isMobile ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", paddingTop: 1 }}>
                {/* Row 1: first 4 filters */}
                <div style={{ display: "flex", gap: 8 }}>
                  {FILTERS.slice(0, 4).map((f) => (
                    <button
                      key={f.key}
                      style={{ ...chipStyle(activeFilter === f.key), flex: 1 }}
                      onClick={() => setActiveFilter(f.key)}
                      onMouseEnter={(e) => { if (activeFilter !== f.key) { e.currentTarget.style.borderColor = colors.ink; e.currentTarget.style.color = colors.ink } }}
                      onMouseLeave={(e) => { if (activeFilter !== f.key) { e.currentTarget.style.borderColor = colors.rule; e.currentTarget.style.color = colors.muted } }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                {/* Row 2: last 3 filters, centered */}
                <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                  {FILTERS.slice(4).map((f) => (
                    <button
                      key={f.key}
                      style={{ ...chipStyle(activeFilter === f.key), flex: 1, maxWidth: "calc(25% - 6px)" }}
                      onClick={() => setActiveFilter(f.key)}
                      onMouseEnter={(e) => { if (activeFilter !== f.key) { e.currentTarget.style.borderColor = colors.ink; e.currentTarget.style.color = colors.ink } }}
                      onMouseLeave={(e) => { if (activeFilter !== f.key) { e.currentTarget.style.borderColor = colors.rule; e.currentTarget.style.color = colors.muted } }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* ── Desktop filter layout: single row, right-aligned ── */
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
            )}
          </div>
        </div>

        {/* Event rows */}
        <div style={{ borderTop: `0.5px solid ${colors.rule}` }}>
          {!eventsLoaded && (
            <div style={{ padding: "40px 0", textAlign: "center", fontFamily: fonts.ui, fontSize: fontSizes.note, fontWeight: 300, letterSpacing: letterSpacing.body, color: colors.hint }}>
              Loading events…
            </div>
          )}
          {eventsLoaded && filtered.length === 0 && (
            <div style={{ padding: "40px 0", textAlign: "center", fontFamily: fonts.ui, fontSize: fontSizes.note, fontWeight: 300, letterSpacing: letterSpacing.body, color: colors.hint }}>
              No events found.
            </div>
          )}
          {filtered.map((event, index) => (
            <CalRow key={event.id} event={event} index={index} onClick={() => setDrawerEvent(event)} />
          ))}
        </div>

        {/* Paywall nudge */}
        {!session && moreCount > 0 && (
          <div
            onClick={() => scrollTo(anchors.paywallGate)}
            onMouseEnter={(e) => (e.currentTarget.style.color = colors.ink)}
            onMouseLeave={(e) => (e.currentTarget.style.color = colors.hint)}
            style={{ textAlign: "center", padding: "32px 0 8px", fontFamily: fonts.ui, fontSize: fontSizes.label, fontWeight: 300, letterSpacing: letterSpacing.subline, textTransform: "uppercase", color: colors.hint, cursor: "pointer", transition: `color ${trans.fast}` }}
          >
            — {moreCount} more event{moreCount !== 1 ? "s" : ""} this month —
          </div>
        )}
      </div>

      {/* ── Event Drawer ── */}
      <AnimatePresence>
        {drawerEvent && (
          <>
            {/* Backdrop — zIndex 150 keeps it above the sticky nav (100) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              style={{ position: "fixed", inset: 0, background: colors.ink, zIndex: 150 }}
              onClick={() => setDrawerEvent(null)}
            />

            {/* Drawer panel — zIndex 151 */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              style={{
                position:        "fixed",
                top:             0,
                right:           0,
                bottom:          0,
                width:           isMobile ? "100vw" : 420,
                background:      colors.cream,
                zIndex:          151,
                overflowY:       "auto",
                display:         "flex",
                flexDirection:   "column",
                gap:             20,
                // More top padding on mobile so content starts below the ✕ button
                padding:         isMobile ? "72px 28px 48px" : "56px 48px 48px",
              }}
            >
              {/* ✕ Close button — always at top-right, above content */}
              <button
                onClick={() => setDrawerEvent(null)}
                style={{
                  position:   "fixed",
                  top:        20,
                  right:      isMobile ? 20 : 20,
                  background: "none",
                  border:     "none",
                  fontSize:   20,
                  cursor:     "pointer",
                  color:      colors.ink,
                  zIndex:     152,
                  padding:    8,
                  lineHeight: 1,
                }}
                aria-label="Close event details"
              >
                ✕
              </button>

              {/* Date + day */}
              <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.tag, fontWeight: 300, letterSpacing: letterSpacing.subline, textTransform: "uppercase", color: colors.hint }}>
                {monthName} {drawerEvent.date}, {CALENDAR_YEAR} · {drawerEvent.day}
              </div>

              {/* Event name */}
              <div style={{ fontFamily: fonts.display, fontSize: fontSizes.confirm, fontWeight: 400, color: colors.ink, lineHeight: 1.3 }}>
                {drawerEvent.name}
              </div>

              {/* Venue */}
              <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.sub, fontWeight: 300, color: colors.muted, letterSpacing: letterSpacing.body }}>
                {drawerEvent.venue}
              </div>

              {/* Time */}
              <div style={{ fontFamily: fonts.ui, fontSize: fontSizes.note, fontWeight: 300, color: colors.hint, letterSpacing: letterSpacing.signIn }}>
                {drawerEvent.time}
              </div>

              {/* Description */}
              {drawerEvent.description && (
                <p style={{
                  fontFamily:    fonts.ui,
                  fontSize:      fontSizes.body,
                  fontWeight:    300,
                  lineHeight:    1.85,
                  color:         colors.body,
                  letterSpacing: letterSpacing.body,
                  margin:        0,
                  paddingTop:    4,
                  borderTop:     `0.5px solid ${colors.rule}`,
                }}>
                  {drawerEvent.description}
                </p>
              )}

              {/* Calendar links */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 8, alignItems: "flex-start" }}>
                {/* Add to Google Calendar */}
                <a
                  href={gcalUrl(drawerEvent)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={calLinkStyle}
                >
                  Add to Google Calendar
                </a>

                {/* Add to Outlook Calendar (ICS download) */}
                <button
                  onClick={() => downloadICS(drawerEvent)}
                  style={{
                    ...calLinkStyle,
                    background: "none",
                    border:     "none",
                    borderBottom: `0.5px solid ${colors.ink}`,
                    padding:    0,
                    paddingBottom: 1,
                  }}
                >
                  Add to Outlook Calendar
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </section>
  )
}
