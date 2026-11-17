import { NextResponse } from "next/server"
import { appsScriptPost } from "@/lib/appsScript"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    return NextResponse.json(await appsScriptPost({ action: "getEvents" }))
  } catch (err) {
    console.error("Events fetch error:", err)
    return NextResponse.json({ events: [], month: null, year: null })
  }
}
