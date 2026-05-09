import { NextResponse } from "next/server"

const WEBHOOK_URL = process.env.APPS_SCRIPT_URL ?? ""

export async function GET() {
  try {
    const res = await fetch(WEBHOOK_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action: "getEvents" }),
      next:    { revalidate: 3600 }, // cache for 1 hour
    })

    if (!res.ok) {
      throw new Error(`Webhook returned ${res.status}`)
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error("Events fetch error:", err)
    return NextResponse.json({ events: [], month: null, year: null })
  }
}
