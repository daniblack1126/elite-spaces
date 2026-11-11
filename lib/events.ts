// ── AUTOMATICALLY UPDATES TO CURRENT MONTH & YEAR ─────────────────────────
const now = new Date();
export const CALENDAR_MONTH = now.getMonth()   // 0-indexed: 0 = Jan, 4 = May, 5 = June, etc.
export const CALENDAR_YEAR  = now.getFullYear()
// ──────────────────────────────────────────────────────────────────────────
export interface Event {
  id:          number
  date:        number
  day:         string
  name:        string
  venue:       string
  time:        string
  categories:  string[]
  isFree:      boolean
  description: string
}

export const FILTERS = [
  { key: "all",      label: "All"      },
  { key: "gala",     label: "Galas"    },
  { key: "beauty",   label: "Beauty"   },
  { key: "free",     label: "Free"     },
  { key: "popup",    label: "Pop-ups"  },
  { key: "industry", label: "Industry" },
  { key: "art",      label: "Art"      },
]

export const PAYWALL_PREVIEW = [
  { date: 19, day: "Tue", name: "City Harvest Gala — Shaken, Not Stirred", venue: "NYC · Evening",                            tag: "Gala", isFree: false },
  { date: 22, day: "Fri", name: "Citi Concert Series — Bleachers",          venue: "Rockefeller Plaza · Free outdoor concert", tag: "Free", isFree: true  },
]
