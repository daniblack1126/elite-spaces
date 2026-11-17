import { NextRequest, NextResponse } from "next/server"
import type { Session } from "@/lib/types"
import { appsScriptGet } from "@/lib/appsScript"
import { encodeSession, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/session"

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")
  const email = req.nextUrl.searchParams.get("email")?.toLowerCase().trim()

  if (!token || !email) {
    return NextResponse.json({ result: "error" }, { status: 400 })
  }

  try {
    const data = await appsScriptGet<Record<string, string>>({ action: "verify", token, email })

    if (data.result !== "success") {
      return NextResponse.json(data)
    }

    const session: Session = {
      firstName:      data.firstName,
      email,
      plan:           data.plan,
      subscriptionId: data.subscriptionId ?? "",
    }

    const response = NextResponse.json({ result: "success", ...session })
    response.cookies.set(SESSION_COOKIE, encodeSession(session), SESSION_COOKIE_OPTIONS)
    return response
  } catch (err) {
    console.error("Verify error:", err)
    return NextResponse.json({ result: "error" }, { status: 500 })
  }
}
