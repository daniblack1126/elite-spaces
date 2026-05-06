import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Elite Spaces NYC",
  description:
    "A private social briefing for New York City — curated monthly events for those who move through New York with intention.",
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
      <body>{children}</body>
    </html>
  )
}
