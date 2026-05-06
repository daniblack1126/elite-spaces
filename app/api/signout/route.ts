import { NextResponse } from "next/server"

export async function POST() {
  const res = NextResponse.json({ result: "ok" })
  res.cookies.set("es_session", "", {
    httpOnly: true,
    maxAge:   0,
    path:     "/",
  })
  return res
}
