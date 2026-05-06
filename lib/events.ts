export interface Event {
  id:         number
  date:       number
  day:        string
  name:       string
  venue:      string
  time:       string
  categories: string[]
  isFree:     boolean
}

export const PREVIEW_EVENTS: Event[] = [
  { id: 1,  date: 2,  day: "Sat", name: "Vogue Café — Pre-Met Pop-Up",               venue: "Spring St & Sixth Ave, SoHo",           time: "May 2–4, 10AM–5PM",   categories: ["fashion", "popup"],    isFree: false },
  { id: 2,  date: 3,  day: "Sun", name: "The People's Ball — Eve of the Met",         venue: "Brooklyn Central Library",              time: "Evening",             categories: ["gala", "free"],        isFree: true  },
  { id: 3,  date: 4,  day: "Mon", name: "The 2026 Met Gala — Fashion Is Art",         venue: "The Metropolitan Museum of Art",        time: "Invitation only",     categories: ["gala", "fashion"],     isFree: false },
  { id: 4,  date: 7,  day: "Thu", name: "NYC Ballet Spring Gala — Set in Stone",      venue: "David H. Koch Theater, Lincoln Center", time: "5:30PM",              categories: ["gala", "art"],         isFree: false },
  { id: 5,  date: 8,  day: "Fri", name: "Citi Concert Series — Zara Larsson",         venue: "Rockefeller Plaza",                     time: "Free outdoor concert", categories: ["free"],               isFree: true  },
  { id: 6,  date: 10, day: "Sun", name: "Costume Art Exhibition Opens",               venue: "The Met, Condé M. Nast Galleries",      time: "Opens May 10",        categories: ["art", "fashion"],      isFree: false },
  { id: 7,  date: 14, day: "Thu", name: "Bryant Park Cuban Salsa Festival",           venue: "Bryant Park",                           time: "6PM–10PM",            categories: ["free"],                isFree: true  },
  { id: 8,  date: 16, day: "Sat", name: "Park Avenue Day 2026",                       venue: "Park Avenue, 34th–40th St",             time: "10AM–6PM",            categories: ["free", "art"],         isFree: true  },
]

export const FULL_EVENTS: Event[] = [
  ...PREVIEW_EVENTS,
  { id: 9,  date: 1,  day: "Fri", name: "Made in NYC Week Opens",                    venue: "Citywide — studios, markets, boutiques", time: "May 1–7",            categories: ["popup", "free"],       isFree: true  },
  { id: 10, date: 1,  day: "Fri", name: "Audible Story House Opens",                 venue: "260 Bowery",                             time: "May 1–31, Wed–Sun",  categories: ["art", "free"],         isFree: true  },
  { id: 11, date: 2,  day: "Sat", name: "TikTok Shop Beauty Besties Pop-Up",         venue: "25 Little W 12th St, Meatpacking",       time: "10AM–4PM",           categories: ["beauty", "popup"],     isFree: true  },
  { id: 12, date: 2,  day: "Sat", name: "Wella Professionals — The Wella Vault",     venue: "NYC",                                    time: "May 2",              categories: ["beauty", "popup"],     isFree: false },
  { id: 13, date: 2,  day: "Sat", name: "Blake Brown Beauty Pop-Up Truck",           venue: "Union Square → SoHo Target",             time: "12PM–5PM",           categories: ["beauty", "popup"],     isFree: true  },
  { id: 14, date: 2,  day: "Sat", name: "Vogue Café — Pre-Met Pop-Up",               venue: "Spring St & Sixth Ave, SoHo",            time: "May 2–4, 10AM–5PM",  categories: ["fashion", "popup"],    isFree: false },
  { id: 15, date: 4,  day: "Mon", name: "got2b Non-Stop Store",                      venue: "Union Square + roving NYC",              time: "10AM–6PM",           categories: ["beauty", "popup"],     isFree: true  },
  { id: 16, date: 7,  day: "Thu", name: "Beauty of Joseon SPF Pop-Up",               venue: "Times Square Plaza",                     time: "May 7–8",            categories: ["beauty", "popup"],     isFree: true  },
  { id: 17, date: 9,  day: "Sat", name: "NYC Community Week Opens",                  venue: "100+ venues across all 5 boroughs",      time: "May 9–17",           categories: ["free"],                isFree: true  },
  { id: 18, date: 10, day: "Sun", name: "Macy's Flower Show — Final Day",            venue: "Macy's Herald Square",                   time: "Last day",           categories: ["beauty", "popup"],     isFree: false },
  { id: 19, date: 11, day: "Mon", name: "WWD Beauty CEO Summit Opens",               venue: "The Breakers, Palm Beach, FL",           time: "May 11–13",          categories: ["industry"],            isFree: false },
  { id: 20, date: 11, day: "Mon", name: "Spring Waterfront Benefit — The Frying Pan",venue: "The Frying Pan, Hudson River",           time: "7PM–10PM",           categories: ["gala"],                isFree: false },
  { id: 21, date: 12, day: "Tue", name: "MoMA PS1 Annual Benefit",                   venue: "MoMA PS1, Queens",                       time: "7PM cocktails",      categories: ["gala", "art"],         isFree: false },
  { id: 22, date: 12, day: "Tue", name: "Black-Tie Society Benefit",                 venue: "583 Park Avenue",                        time: "5:30PM",             categories: ["gala"],                isFree: false },
  { id: 23, date: 12, day: "Tue", name: "ALO Dance Cardio at Hudson Yards",          venue: "Backyard at Hudson Yards",               time: "Biweekly, Tuesdays", categories: ["free"],                isFree: true  },
  { id: 24, date: 14, day: "Thu", name: "RetailMediaIQ Pop-Up — VIP Night",          venue: "422 W Broadway, SoHo",                   time: "Invite-only",        categories: ["beauty", "industry"],  isFree: false },
  { id: 25, date: 15, day: "Fri", name: "RetailMediaIQ — Consumer Days",             venue: "422 W Broadway, SoHo",                   time: "May 15–17, 11AM–5PM",categories: ["beauty", "popup"],     isFree: true  },
  { id: 26, date: 16, day: "Sat", name: "Park Avenue Day 2026",                      venue: "Park Avenue, 34th–40th St",              time: "10AM–6PM",           categories: ["free", "art"],         isFree: true  },
  { id: 27, date: 19, day: "Tue", name: "City Harvest Gala — Shaken, Not Stirred",   venue: "NYC",                                    time: "Evening",            categories: ["gala"],                isFree: false },
  { id: 28, date: 22, day: "Fri", name: "Citi Concert Series — Bleachers",           venue: "Rockefeller Plaza",                      time: "Free outdoor concert",categories: ["free"],               isFree: true  },
  { id: 29, date: 28, day: "Thu", name: "Bryant Park Picnic Performances Opens",     venue: "Bryant Park Lawn",                       time: "7PM",                categories: ["free", "art"],         isFree: true  },
  { id: 30, date: 29, day: "Fri", name: "Citi Concert Series — Charlie Puth",        venue: "Rockefeller Plaza",                      time: "Free outdoor concert",categories: ["free"],               isFree: true  },
  { id: 31, date: 30, day: "Sat", name: "Carnegie Hall at Hudson Yards — Film Night", venue: "Backyard at Hudson Yards",              time: "Free screening",     categories: ["art", "free"],         isFree: true  },
]

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
