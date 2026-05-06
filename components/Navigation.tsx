"use client"

import { useState, useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  colors, fonts, fontSizes, letterSpacing, spacing, trans, anchors,
  MOBILE_BP, btnDark,
} from "@/lib/tokens"
import { scrollTo } from "@/lib/utils"
import type { Session } from "@/lib/types"

interface Props {
  session:    Session | null
  onSignOut:  () => void
}

export default function Navigation({ session, onSignOut }: Props) {
  const [scrolled,  setScrolled]  = useState(false)
  const [menuOpen,  setMenuOpen]  = useState(false)
  const [isMobile,  setIsMobile]  = useState(false)

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
    position:     "sticky",
    top:          0,
    zIndex:       100,
    background:   scrolled ? colors.cream : "transparent",
    borderBottom: scrolled ? `0.5px solid ${colors.rule}` : "0.5px solid transparent",
    padding:      spacing.pagePadding,
    height:       spacing.navHeight,
    display:      "flex",
    alignItems:   "center",
    justifyContent: "space-between",
    transition:   `background ${trans.medium}, border-color ${trans.medium}`,
    width:        "100%",
    fontFamily:   fonts.ui,
  }

  const wordmarkStyle: React.CSSProperties = {
    fontFamily:    fonts.display,
    fontStyle:     "italic",
    fontSize:      fontSizes.wordmark,
    fontWeight:    400,
    letterSpacing: letterSpacing.wordmark,
    textTransform: "uppercase",
    color:         colors.ink,
    textDecoration: "none",
    cursor:        "pointer",
  }

  const linkStyle: React.CSSProperties = {
    fontFamily:    fonts.ui,
    fontSize:      fontSizes.label,
    fontWeight:    300,
    letterSpacing: letterSpacing.navLink,
    textTransform: "uppercase",
    color:         colors.muted,
    textDecoration: "none",
    cursor:        "pointer",
    transition:    `color ${trans.fast}`,
    background:    "none",
    border:        "none",
    padding:       0,
  }

  const ctaStyle: React.CSSProperties = {
    fontFamily:    fonts.ui,
    fontSize:      fontSizes.label,
    fontWeight:    300,
    letterSpacing: letterSpacing.navLink,
    textTransform: "uppercase",
    color:         colors.ink,
    borderBottom:  `0.5px solid ${colors.ink}`,
    paddingBottom: 1,
    cursor:        "pointer",
    textDecoration: "none",
    transition:    `color ${trans.fast}, border-color ${trans.fast}`,
  }

  const lineStyle: React.CSSProperties = { width: 20, height: 0.5, background: colors.ink }

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
            onClick={(e) => { e.preventDefault(); onSignOut() }}
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
            <button
              onClick={() => setMenuOpen(false)}
              style={{ position: "absolute", top: 20, right: 24, background: "none", border: "none", fontSize: 24, cursor: "pointer", color: colors.ink }}
            >
              ✕
            </button>
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
              <button
                onClick={() => { onSignOut(); setMenuOpen(false) }}
                style={{ ...(btnDark as React.CSSProperties), cursor: "pointer" }}
              >
                Sign Out
              </button>
            ) : (
              <a
                href={`#${anchors.accessForm}`}
                onClick={() => { scrollTo(anchors.accessForm); setMenuOpen(false) }}
                style={btnDark as React.CSSProperties}
              >
                Request Access
              </a>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
