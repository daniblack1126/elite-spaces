import type { Metadata } from "next"
import "./globals.css"
import { Analytics } from "@vercel/analytics/react"

export const metadata: Metadata = {
  title: "Elite Spaces NYC — Curated Monthly Events for New York",
  description:
    "A private social briefing for New York City — curated monthly events for those who move through New York with intention.",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title:       "Elite Spaces NYC — Curated Monthly Events for New York",
    description: "A private social briefing for New York City — curated monthly events for those who move through New York with intention.",
    url:         "https://elitespaces.nyc",
    siteName:    "Elite Spaces NYC",
    locale:      "en_US",
    type:        "website",
    images: [
      {
        url:    "https://elitespaces.nyc/opengraph-image",
        width:  1200,
        height: 630,
        alt:    "Elite Spaces NYC",
      },
    ],
  },
  twitter: {
    card:        "summary_large_image",
    title:       "Elite Spaces NYC — Curated Monthly Events for New York",
    description: "A private social briefing for New York City — curated monthly events for those who move through New York with intention.",
    images:      ["https://elitespaces.nyc/opengraph-image"],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Inter:wght@300;400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
