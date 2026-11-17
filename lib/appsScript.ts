// Every call from the site to the Google Apps Script web app goes through here, so the
// URL and the shared secret live in one place (Vercel env vars), not in browser code.

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL ?? ""
const APPS_SCRIPT_SECRET = process.env.APPS_SCRIPT_SECRET ?? ""

export async function appsScriptPost<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  if (!APPS_SCRIPT_URL) throw new Error("APPS_SCRIPT_URL is not set")
  const res = await fetch(APPS_SCRIPT_URL, {
    method:   "POST",
    headers:  { "Content-Type": "text/plain" },
    body:     JSON.stringify({ ...body, secret: APPS_SCRIPT_SECRET }),
    redirect: "follow",
    cache:    "no-store",
  })
  if (!res.ok) throw new Error(`Apps Script returned ${res.status}`)
  return (await res.json()) as T
}

export async function appsScriptGet<T = Record<string, unknown>>(params: Record<string, string>): Promise<T> {
  if (!APPS_SCRIPT_URL) throw new Error("APPS_SCRIPT_URL is not set")
  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`${APPS_SCRIPT_URL}?${qs}`, { redirect: "follow", cache: "no-store" })
  if (!res.ok) throw new Error(`Apps Script returned ${res.status}`)
  return (await res.json()) as T
}
