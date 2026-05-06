"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { colors, fonts, fontSizes, letterSpacing, spacing, trans } from "@/lib/tokens"

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

export default function Footer() {
  const [modal, setModal] = useState<null | "privacy" | "terms">(null)

  const footerLinkStyle: React.CSSProperties = {
    color:          colors.muted,
    textDecoration: "none",
    cursor:         "pointer",
    transition:     `color ${trans.fast}`,
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
          <a
            style={footerLinkStyle}
            href="#"
            onClick={(e) => { e.preventDefault(); setModal("privacy") }}
            onMouseEnter={(e) => (e.currentTarget.style.color = colors.cream)}
            onMouseLeave={(e) => (e.currentTarget.style.color = colors.muted)}
          >
            Privacy
          </a>
          {" · "}
          <a
            style={footerLinkStyle}
            href="#"
            onClick={(e) => { e.preventDefault(); setModal("terms") }}
            onMouseEnter={(e) => (e.currentTarget.style.color = colors.cream)}
            onMouseLeave={(e) => (e.currentTarget.style.color = colors.muted)}
          >
            Terms
          </a>
        </div>
      </footer>

      <AnimatePresence>
        {modal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ position: "fixed", inset: 0, background: colors.inkOverlay, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}
            onClick={() => setModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              style={{ background: colors.cream, maxWidth: 560, width: "100%", maxHeight: "80vh", overflowY: "auto", padding: "48px 52px", position: "relative" }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setModal(null)}
                style={{ position: "absolute", top: 16, right: 20, background: "none", border: "none", fontSize: 20, cursor: "pointer", color: colors.ink }}
              >
                ✕
              </button>
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
