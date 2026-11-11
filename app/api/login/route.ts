import { NextRequest, NextResponse } from "next/server"
import { appsScriptGet } from "@/lib/appsScript"

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email")?.toLowerCase().trim()
  if (!email) return NextResponse.json({ result: "error" }, { status: 400 })

  try {
    return NextResponse.json(await appsScriptGet({ action: "login", email }))
  } catch (err) {
    console.error("Login error:", err)
    return NextResponse.json({ result: "error" }, { status: 500 })
  }
}
