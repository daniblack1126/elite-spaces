// ─────────────────────────────────────────────────────────────────────────────
// ELITE SPACES — EVENTS API ADDITION FOR GOOGLE APPS SCRIPT
// ─────────────────────────────────────────────────────────────────────────────
//
// HOW TO INSTALL:
//   1. Go to script.google.com and open your existing Elite Spaces script
//   2. Paste the EVENTS_SHEET_ID constant and the three helper functions below
//      into your script file (anywhere outside the existing doPost function)
//   3. Inside your existing doPost(e) function, add the three new case blocks
//      shown at the bottom of this file into your switch/if statement
//   4. Click Deploy > Manage deployments > Edit (pencil icon) > Version: New version > Deploy
//   5. The URL stays the same — no changes needed in EliteSpaces.tsx or Vercel
//
// ─────────────────────────────────────────────────────────────────────────────

// ── STEP 1: Add this constant near the top of your script ────────────────────

const EVENTS_SHEET_ID = "1AN3k5Rc_f-LN9nQKWzn--oboGqIeTf3CCK_XiOwdkgY";

// ── STEP 2: Add these helper functions anywhere in your script ────────────────

/**
 * Parse a date string from the Events sheet into {date, day}.
 * Handles formats like "May 7, 2026", "May 13-17, 2026", "Opens May 10, 2026 (through...)"
 * Returns { date: 7, day: "Thu" } — the day-of-month number and abbreviated day name.
 */
function parseEventDate_(dateStr) {
  if (!dateStr) return { date: null, day: null };
  // Extract the first recognizable date: "Month D, YYYY"
  const match = dateStr.match(/([A-Za-z]+)\s+(\d+)(?:[–\-]\d+)?,?\s+(\d{4})/);
  if (!match) return { date: null, day: null };
  const parsed = new Date(`${match[1]} ${match[2]}, ${match[3]}`);
  if (isNaN(parsed.getTime())) return { date: null, day: null };
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    date: parsed.getDate(),
    day: days[parsed.getDay()],
    fullDate: parsed
  };
}

/**
 * Auto-assign categories and isFree for a new event based on name + description.
 * Returns { categories: "beauty,popup", isFree: true }
 * Used when the pipeline sends events without categories already set.
 */
function inferCategories_(name, description) {
  const text = (name + " " + description).toLowerCase();
  const cats = [];
  if (/gala|benefit|dinner|fundraiser|black.tie/.test(text)) cats.push("gala");
  if (/beauty|skincare|fragrance|makeup|cosmetic|sephora|ulta|lanc[oô]me|fenty|k-beauty|pop-up.*beauty|beauty.*pop-up/.test(text)) cats.push("beauty");
  if (/pop.?up|activation|launch|opening|showroom|store/.test(text)) cats.push("popup");
  if (/art|museum|gallery|exhibition|moma|met |guggenheim|frieze|performance|theater|theatre|ballet|opera|concert/.test(text)) cats.push("art");
  if (/industry|trade show|b2b|supplier|professional|summit/.test(text)) cats.push("industry");
  const isFree = /\bfree\b|no cost|complimentary|open to (all|public)/.test(text);
  if (isFree) cats.push("free");
  return {
    categories: cats.join(",") || "art",
    isFree: isFree
  };
}

/**
 * Read all rows from the Events sheet and return as an array of objects.
 * Column order: Event Name, Date, Time, Location, Description, Source URL,
 *               Vibe Score, Status, Notes, Categories, isFree
 */
function getEventsSheetRows_() {
  try {
    const ss = SpreadsheetApp.openById(EVENTS_SHEET_ID);
    const sheet = ss.getActiveSheet();
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];
    const headers = data[0].map(h => h.toString().trim());
    return data.slice(1).map((row, i) => {
      const obj = {};
      headers.forEach((h, j) => { obj[h] = row[j]; });
      obj._rowIndex = i + 2; // 1-indexed, offset for header
      return obj;
    });
  } catch (e) {
    Logger.log("getEventsSheetRows_ error: " + e.message);
    return [];
  }
}

// ── STEP 3: Add these cases inside your existing doPost switch/if block ───────
//
// Your current doPost likely looks like:
//
//   function doPost(e) {
//     const payload = JSON.parse(e.postData.contents);
//     const action = payload.action;
//     if (action === "verify") { ... }
//     if (action === "login")  { ... }
//     ...
//   }
//
// Add the three blocks below as additional if/else-if branches.

// ─── ACTION: getEvents ────────────────────────────────────────────────────────
// Called by the website (EliteSpaces.tsx CalendarView) on page load.
// Returns all Published or Approved events for the current calendar month
// in the format CalendarView expects.

/*
  if (action === "getEvents") {
    const rows = getEventsSheetRows_();
    const now = new Date();
    const currentMonth = now.getMonth();   // 0-indexed
    const currentYear  = now.getFullYear();

    const events = [];
    let id = 1;

    rows.forEach(row => {
      const status = (row["Status"] || "").toString().trim();
      if (status !== "Published" && status !== "Approved") return;

      const parsed = parseEventDate_(row["Date"] ? row["Date"].toString() : "");
      if (!parsed.fullDate) return;

      // Only include events in the current calendar month
      if (parsed.fullDate.getMonth() !== currentMonth || parsed.fullDate.getFullYear() !== currentYear) return;

      const categoriesRaw = (row["Categories"] || "").toString().trim();
      const isFreeRaw = row["isFree"];
      const isFree = isFreeRaw === true || isFreeRaw === "true" || isFreeRaw === "TRUE";

      let cats = categoriesRaw ? categoriesRaw.split(",").map(c => c.trim()).filter(Boolean) : [];
      if (isFree && !cats.includes("free")) cats.push("free");

      const vibeScore = parseInt((row["Vibe Score"] || "0").toString()) || 0;

      events.push({
        id:          id++,
        date:        parsed.date,
        day:         parsed.day,
        name:        (row["Event Name"] || "").toString(),
        venue:       (row["Location"] || "").toString(),
        time:        (row["Time"] || "").toString(),
        description: (row["Description"] || "").toString(),
        categories:  cats,
        isFree:      isFree,
        vibeScore:   vibeScore
      });
    });

    // Sort by day of month
    events.sort((a, b) => (a.date || 0) - (b.date || 0));

    return ContentService
      .createTextOutput(JSON.stringify({ events: events, month: currentMonth + 1, year: currentYear }))
      .setMimeType(ContentService.MimeType.JSON);
  }
*/

// ─── ACTION: updateEvents ─────────────────────────────────────────────────────
// Called by the weekly pipeline after discovering new events.
// Receives an array of events. Upserts each one:
//   - If an event with the same name exists: update Time/Location/Description/Notes
//     but PRESERVE the existing Status (so Dani's approvals are not overwritten)
//   - If the event is new: append as a new row with Status = "Pending Review"

/*
  if (action === "updateEvents") {
    const incomingEvents = payload.events || [];
    if (!incomingEvents.length) {
      return ContentService
        .createTextOutput(JSON.stringify({ result: "no_events" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const ss = SpreadsheetApp.openById(EVENTS_SHEET_ID);
    const sheet = ss.getActiveSheet();
    const existingRows = getEventsSheetRows_();

    // Build a lookup map by event name (lowercased for fuzzy match)
    const existingMap = {};
    existingRows.forEach(row => {
      const key = (row["Event Name"] || "").toString().toLowerCase().trim();
      existingMap[key] = row;
    });

    let added = 0, updated = 0;

    incomingEvents.forEach(ev => {
      const key = (ev["Event Name"] || "").toLowerCase().trim();
      const existing = existingMap[key];

      if (existing) {
        // Update mutable fields only — preserve Status
        const rowIdx = existing._rowIndex;
        // Column indexes (1-indexed): Time=3, Location=4, Description=5, Notes=9, Categories=10, isFree=11
        sheet.getRange(rowIdx, 3).setValue(ev["Time"] || existing["Time"]);
        sheet.getRange(rowIdx, 4).setValue(ev["Location"] || existing["Location"]);
        sheet.getRange(rowIdx, 5).setValue(ev["Description"] || existing["Description"]);
        if (ev["Notes"]) sheet.getRange(rowIdx, 9).setValue(ev["Notes"]);
        if (ev["Categories"]) sheet.getRange(rowIdx, 10).setValue(ev["Categories"]);
        if (ev["isFree"] !== undefined) sheet.getRange(rowIdx, 11).setValue(ev["isFree"]);
        updated++;
      } else {
        // New event — append row
        const cats = ev["Categories"] || inferCategories_(ev["Event Name"] || "", ev["Description"] || "").categories;
        const isFree = ev["isFree"] !== undefined ? ev["isFree"] : inferCategories_(ev["Event Name"] || "", ev["Description"] || "").isFree;
        sheet.appendRow([
          ev["Event Name"] || "",
          ev["Date"] || "",
          ev["Time"] || "",
          ev["Location"] || "",
          ev["Description"] || "",
          ev["Source URL"] || "",
          ev["Vibe Score"] || "",
          "Pending Review",
          ev["Notes"] || "",
          cats,
          isFree
        ]);
        added++;
      }
    });

    SpreadsheetApp.flush();

    return ContentService
      .createTextOutput(JSON.stringify({ result: "success", added: added, updated: updated }))
      .setMimeType(ContentService.MimeType.JSON);
  }
*/

// ─── ACTION: publishApproved ──────────────────────────────────────────────────
// Called by the monthly publish task on the first Sunday of each month.
// Finds all events with Status = "Approved" and changes them to "Published".
// Returns the count and names of newly published events.

/*
  if (action === "publishApproved") {
    const ss = SpreadsheetApp.openById(EVENTS_SHEET_ID);
    const sheet = ss.getActiveSheet();
    const rows = getEventsSheetRows_();
    const published = [];

    rows.forEach(row => {
      if ((row["Status"] || "").toString().trim() === "Approved") {
        // Status column is index 8 (column H, 1-indexed = 8)
        sheet.getRange(row._rowIndex, 8).setValue("Published");
        published.push(row["Event Name"] || "");
      }
    });

    SpreadsheetApp.flush();

    return ContentService
      .createTextOutput(JSON.stringify({ result: "success", published: published, count: published.length }))
      .setMimeType(ContentService.MimeType.JSON);
  }
*/

// ─────────────────────────────────────────────────────────────────────────────
// STATUS WORKFLOW FOR THE "Status" COLUMN:
//
//   Pending Review  →  Dani reviews in the sheet
//   Approved        →  Dani has approved; pipeline will publish on first Sunday
//   Published       →  Live on the website (set automatically by publishApproved)
//   Rejected        →  Dani doesn't want this event (pipeline will skip it)
//
// The website (getEvents) shows events with Status = "Published" OR "Approved".
// On the first Sunday of each month, publishApproved flips Approved → Published,
// which is mainly for your own record-keeping of what went live when.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT: After pasting this code, you must re-deploy the script.
// In Apps Script: Deploy > Manage deployments > (pencil/edit icon) >
//   Version: "New version" > Deploy.
// The webhook URL stays the same — no changes needed anywhere else.
// ─────────────────────────────────────────────────────────────────────────────
