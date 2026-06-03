import type React from "react"

export const colors = {
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

export const fonts = {
  display: "'Merriweather', serif",
  ui:      "'Inter', sans-serif",
}

export const fontSizes = {
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
  heroHead:    48,
}

export const letterSpacing = {
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

export const spacing = {
  pagePadding:       "0 60px",
  pagePaddingMobile: "0 24px",
  sectionY:          "40px",
  accessSectionY:    "88px",
  paywallSection:    "0 60px 100px",
  footerPadding:     "36px 60px",
  innerMaxWidth:     780,
  accessMaxWidth:    960,
  paywallCardMax:    460,
  navHeight:         56,
}

export const trans = {
  snap:   "120ms ease",
  fast:   "160ms ease",
  medium: "200ms ease",
}

export const anchors = {
  hero:        "hero",
  accessForm:  "access-form",
  calendar:    "calendar",
  paywallGate: "paywall-gate",
  login:       "login",
}

export const MOBILE_BP = 768

export const btnDark: React.CSSProperties = {
  display:        "inline-block",
  background:     colors.ink,
  color:          colors.cream,
  fontFamily:     fonts.ui,
  fontSize:       fontSizes.label,
  fontWeight:     500,
  letterSpacing:  letterSpacing.button,
  textTransform:  "uppercase",
  padding:        "16px 48px",
  border:         "none",
  borderRadius:   0,
  cursor:         "pointer",
  textDecoration: "none",
  transition:     `background ${trans.fast}`,
}

export const btnDarkFull: React.CSSProperties = {
  ...btnDark,
  display:   "block",
  width:     "100%",
  textAlign: "center",
  padding:   "15px 0",
}

export const labelStyle: React.CSSProperties = {
  fontFamily:    fonts.ui,
  fontSize:      fontSizes.tag,
  fontWeight:    400,
  letterSpacing: letterSpacing.button,
  textTransform: "uppercase",
  color:         colors.muted,
  marginBottom:  6,
  display:       "block",
}
