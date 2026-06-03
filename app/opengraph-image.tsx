import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "Elite Spaces NYC"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function OGImage() {
  const merriweatherData = await fetch(
    new URL("https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,300;0,400;0,500;1,300;1,400", import.meta.url)
  ).then((res) => res.arrayBuffer())

  const interData = await fetch(
    new URL("https://fonts.googleapis.com/css2?family=Inter:wght@300;400", import.meta.url)
  ).then((res) => res.arrayBuffer())

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
            fontFamily: "Inter",
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
            fontFamily: "Merriweather",
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
            fontFamily: "Inter",
            textTransform: "uppercase",
          }}
        >
          elitespaces.nyc
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Merriweather",
          data: merriweatherData,
          style: "italic",
          weight: 300,
        },
        {
          name: "Inter",
          data: interData,
          style: "normal",
          weight: 300,
        },
      ],
    }
  )
}
