import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt     = "Elite Spaces NYC"
export const size    = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width:           "100%",
          height:          "100%",
          display:         "flex",
          flexDirection:   "column",
          alignItems:      "center",
          justifyContent:  "center",
          background:      "#3d2b20",
          fontFamily:      "Georgia, serif",
        }}
      >
        {/* Martini glass SVG */}
        <svg width="120" height="120" viewBox="0 0 100 100" style={{ marginBottom: 32 }}>
          <polygon points="18,18 82,18 58,58 42,58" fill="#F7F5F0" />
          <rect x="47" y="58" width="6" height="20" fill="#F7F5F0" />
          <rect x="30" y="78" width="40" height="5" fill="#F7F5F0" />
          <text x="50" y="44" fontFamily="Georgia, serif" fontSize="18" fontWeight="400" fill="#3d2b20" textAnchor="middle" dominantBaseline="middle">ES</text>
        </svg>

        {/* Site name */}
        <div
          style={{
            fontSize:      72,
            fontWeight:    300,
            color:         "#F7F5F0",
            letterSpacing: "0.08em",
            marginBottom:  16,
          }}
        >
          Elite Spaces
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize:      24,
            fontWeight:    300,
            color:         "#8a8580",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          New York City
        </div>
      </div>
    ),
    { ...size },
  )
}
