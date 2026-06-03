import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "Elite Spaces NYC"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#3d2b20",
          gap: 0,
        }}
      >
        {/* Eyebrow */}
        <div
          style={{
            display: "flex",
            fontSize: 18,
            color: "#8a8580",
            letterSpacing: "0.3em",
            fontFamily: "system-ui, -apple-system, sans-serif",
            textTransform: "uppercase",
            marginBottom: 32,
          }}
        >
          New York City
        </div>
        {/* Main title */}
        <div
          style={{
            display: "flex",
            fontSize: 96,
            fontWeight: 300,
            fontStyle: "italic",
            color: "#F7F5F0",
            letterSpacing: "0.04em",
            fontFamily: "Georgia, serif",
            marginBottom: 24,
          }}
        >
          Elite Spaces
        </div>
        {/* Divider */}
        <div
          style={{
            display: "flex",
            width: 80,
            height: 0.5,
            background: "#8a8580",
            marginBottom: 24,
          }}
        />
        {/* Tagline */}
        <div
          style={{
            display: "flex",
            fontSize: 22,
            fontWeight: 300,
            color: "#8a8580",
            letterSpacing: "0.15em",
            fontFamily: "system-ui, -apple-system, sans-serif",
            textTransform: "uppercase",
          }}
        >
          elitespaces.nyc
        </div>
      </div>
    ),
    { ...size }
  )
}
