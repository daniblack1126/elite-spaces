"use client"

import { useState, useEffect, useRef } from "react"
import { motion, useInView } from "framer-motion"
import { colors, fonts, fontSizes, letterSpacing, MOBILE_BP } from "@/lib/tokens"

const SAMPLE_EVENTS = [
  { name: "Met Gala After-Party", type: "Invitation Only", date: "May 5" },
  { name: "Tribeca Film Festival Opening", type: "Free RSVP", date: "May 8" },
  { name: "Whitney Museum Late Night", type: "Pay What You Wish", date: "May 16" },
  { name: "Rooftop Jazz at The Standard", type: "Free Entry", date: "May 22" },
]

export default function SocialProof() {
  const [isMobile, setIsMobile] = useState(false)
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-10%" })

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= MOBILE_BP)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
  }

  const stagger = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08 } },
  }

  return (
    <section
      ref={ref}
      style={{
        background: colors.cream,
        padding: isMobile ? "28px 24px 32px" : "32px 60px 40px",
        borderTop: `0.5px solid ${colors.rule}`,
      }}
    >
      <motion.div
        initial="hidden"
        animate={inView ? "show" : "hidden"}
        variants={stagger}
        style={{ maxWidth: 900, margin: "0 auto" }}
      >
        <motion.div
          variants={fadeIn}
          style={{
            fontFamily: fonts.ui,
            fontSize: fontSizes.label,
            fontWeight: 300,
            letterSpacing: letterSpacing.eyebrow,
            textTransform: "uppercase",
            color: colors.muted,
            textAlign: "center",
            marginBottom: 18,
          }}
        >
          A glimpse at what members discovered last month
        </motion.div>

        <motion.div
          variants={stagger}
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
            gap: isMobile ? 16 : 24,
          }}
        >
          {SAMPLE_EVENTS.map((event, i) => (
            <motion.div
              key={i}
              variants={fadeIn}
              style={{
                background: colors.warmOff,
                padding: isMobile ? "16px 14px" : "20px 18px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div
                style={{
                  fontFamily: fonts.ui,
                  fontSize: fontSizes.tag,
                  fontWeight: 400,
                  letterSpacing: letterSpacing.tags,
                  textTransform: "uppercase",
                  color: colors.hint,
                }}
              >
                {event.type}
              </div>
              <div
                style={{
                  fontFamily: fonts.display,
                  fontStyle: "italic",
                  fontSize: isMobile ? fontSizes.body : fontSizes.eventName,
                  fontWeight: 300,
                  color: colors.ink,
                  lineHeight: 1.3,
                }}
              >
                {event.name}
              </div>
              <div
                style={{
                  fontFamily: fonts.ui,
                  fontSize: fontSizes.tag,
                  fontWeight: 300,
                  letterSpacing: letterSpacing.chip,
                  textTransform: "uppercase",
                  color: colors.muted,
                  marginTop: "auto",
                }}
              >
                {event.date}
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          variants={fadeIn}
          style={{
            fontFamily: fonts.ui,
            fontSize: fontSizes.note,
            fontWeight: 300,
            letterSpacing: letterSpacing.heroNote,
            color: colors.hint,
            textAlign: "center",
            marginTop: 20,
          }}
        >
          &quot;I&apos;ve lived here 8 years and still discover something new every month.&quot; — Sarah K.
        </motion.div>
      </motion.div>
    </section>
  )
}
