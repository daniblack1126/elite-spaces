import { NextRequest, NextResponse } from "next/server"

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL ?? ""

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email")?.toLowerCase().trim()
  if (!email) return NextResponse.json({ result: "error" }, { status: 400 })

  try {
    const res  = await fetch(`${APPS_SCRIPT_URL}?action=login&email=${encodeURIComponent(email)}`, {
      redirect: "follow",
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error("Login error:", err)
    return NextResponse.json({ result: "error" }, { status: 500 })
  }
}
