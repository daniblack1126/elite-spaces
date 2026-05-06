import { NextRequest, NextResponse } from "next/server"

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL ?? ""

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ result: "error" }, { status: 400 })

  try {
    const res  = await fetch(APPS_SCRIPT_URL, {
      method:   "POST",
      headers:  { "Content-Type": "text/plain" },
      body:     JSON.stringify({ action: "cancel", email }),
      redirect: "follow",
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error("Cancel error:", err)
    return NextResponse.json({ result: "error" }, { status: 500 })
  }
}
