import { NextRequest, NextResponse } from "next/server"
import { appsScriptPost } from "@/lib/appsScript"

// The access form posts here; the Apps Script adds the row and sends the emails.
export async function POST(req: NextRequest) {
  const { firstName, lastName, email, source, handle } = await req.json()
  if (!firstName || !email) {
    return NextResponse.json({ result: "error", message: "Missing fields" }, { status: 400 })
  }

  try {
    const data = await appsScriptPost({
      action:    "apply",
      firstName: String(firstName).trim(),
      lastName:  String(lastName ?? "").trim(),
      email:     String(email).trim().toLowerCase(),
      source:    source ?? "",
      handle:    handle ?? "",
    })
    return NextResponse.json(data)
  } catch (err) {
    console.error("Apply error:", err)
    return NextResponse.json({ result: "error" }, { status: 500 })
  }
}
