import { NextRequest, NextResponse } from "next/server"
import type { Session } from "@/lib/types"

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL ?? ""

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge:   60 * 60 * 24 * 30, // 30 days
  path:     "/",
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")
  const email = req.nextUrl.searchParams.get("email")?.toLowerCase().trim()

  if (!token || !email) {
    return NextResponse.json({ result: "error" }, { status: 400 })
  }

  try {
    const res  = await fetch(
      `${APPS_SCRIPT_URL}?action=verify&token=${token}&email=${encodeURIComponent(email)}`,
      { redirect: "follow" },
    )
    const data = await res.json()

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
    response.cookies.set("es_session", JSON.stringify(session), COOKIE_OPTIONS)
    return response
  } catch (err) {
    console.error("Verify error:", err)
    return NextResponse.json({ result: "error" }, { status: 500 })
  }
}
