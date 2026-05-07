// Elite Spaces NYC — Google Apps Script
// Handles: form submissions, approval emails, Stripe webhooks, magic link login
// Save this file as AppScript.gs in your project repo for reference

const SHEET_NAME = "Sheet1"
const ADMIN_EMAIL = "daniblackbeauty@gmail.com"
const SITE_URL = "https://elitespaces.nyc"
const TIKTOK_URL = "https://www.tiktok.com/@daniblackbeauty"
const STRIPE_MONTHLY_LINK = "https://buy.stripe.com/test_00wdR898P6O2aRqd7f6Na03"
const STRIPE_FOUNDING_LINK = "https://buy.stripe.com/test_6oU4gy98P2xM1gQ7MV6Na02"
const BYPASS_SECRET = "elitespaces2026"
const EVENTS_SHEET_ID = "1qNNo1tCA4sFjal3qik2Vvf7YZxJgLLy_jMqL0H6-aJY"

const COL = {
    timestamp:            1,
    firstName:            2,
    lastName:             3,
    email:                4,
    source:               5,
    handle:               6,  // Instagram / TikTok handle
    applicationStatus:    7,  // you fill: pending → approved / rejected
    memberStatus:         8,  // auto:     payment_pending / active / cancelling / cancelled / payment_failed
    stripeCustomerId:     9,
    stripeSubscriptionId: 10,
    plan:                 11,
    loginToken:           12,
    tokenExpiry:          13,
    appliedAt:            14,
    approvedAt:           15,
    paymentDate:          16,
    nextBillingDate:      17,
    cancelledAt:          18,
    notes:                19,
}

// ── UTILITIES ─────────────────────────────────────────────────────────────────

function getSheet() {
    return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME)
}

function findRowByEmail(email) {
    const sheet = getSheet()
    const data = sheet.getDataRange().getValues()
    for (let i = 1; i < data.length; i++) {
        if (String(data[i][COL.email - 1]).toLowerCase() === email.toLowerCase()) {
            return { row: i + 1, data: data[i] }
        }
    }
    return null
}

function updateCell(row, col, value) {
    getSheet().getRange(row, col).setValue(value)
}

function generateToken() {
    return Utilities.getUuid().replace(/-/g, "")
}

function jsonResponse(obj) {
    return ContentService
        .createTextOutput(JSON.stringify(obj))
        .setMimeType(ContentService.MimeType.JSON)
}

// ── doGet — handles login, verify, bypass (no CORS issues) ───────────────────

function doGet(e) {
    const action = e.parameter.action

    if (action === "login")  return handleLoginGet(e.parameter)
    if (action === "verify") return handleVerifyGet(e.parameter)
    if (action === "bypass") return handleBypass(e.parameter)

    return jsonResponse({ result: "ok" })
}

// ── doPost — handles form submissions, Stripe webhooks, cancellation, events ──

function doPost(e) {
    const data = JSON.parse(e.postData.contents)

    if (data.action === "cancel")          return handleCancel(data)
    if (data.action === "stripe_webhook")  return handleStripeWebhook(data)
    if (data.action === "getEvents")       return handleGetEvents(data)
    if (data.action === "updateEvents")    return handleUpdateEvents(data)
    if (data.action === "publishApproved") return handlePublishApproved(data)

    return handleNewApplication(data)
}

// ── NEW APPLICATION ───────────────────────────────────────────────────────────

function handleNewApplication(data) {
    const sheet = getSheet()
    const now = new Date()

    sheet.appendRow([
        now,                    // A - Timestamp
        data.firstName || "",   // B - First Name
        data.lastName  || "",   // C - Last Name
        data.email     || "",   // D - Email
        data.source    || "",   // E - Source
        data.handle    || "",   // F - Handle (Instagram / TikTok)
        "pending",              // G - Application Status
        "",                     // H - Member Status
        "",                     // I - Stripe Customer ID
        "",                     // J - Stripe Subscription ID
        "",                     // K - Plan
        "",                     // L - Login Token
        "",                     // M - Token Expiry
        now,                    // N - Applied At
        "",                     // O - Approved At
        "",                     // P - Payment Date
        "",                     // Q - Next Billing Date
        "",                     // R - Cancelled At
        "",                     // S - Notes
    ])

    MailApp.sendEmail({
        to: data.email,
        subject: "You're on the list — Elite Spaces",
        htmlBody: approvalConfirmationEmail(data.firstName)
    })

    MailApp.sendEmail({
        to: ADMIN_EMAIL,
        subject: `New Elite Spaces application — ${data.firstName} ${data.lastName}`,
        body: `New application:\n\nName: ${data.firstName} ${data.lastName}\nEmail: ${data.email}\nHandle: ${data.handle || "—"}\nSource: ${data.source}\nTime: ${now}\n\nSet status to "approved" in column G of the sheet to trigger the payment email.`
    })

    return jsonResponse({ result: "success" })
}

// ── ON-EDIT TRIGGER ───────────────────────────────────────────────────────────
// Fires automatically when you type in the sheet.
// To activate: Apps Script editor → Triggers (clock icon) → Add trigger
//   Function: onEdit | Event source: From spreadsheet | Event type: On edit

function onEdit(e) {
    const sheet = e.source.getActiveSheet()
    const col   = e.range.getColumn()
    const row   = e.range.getRow()

    // Only watch Col F (Application Status), skip header row
    if (col !== COL.applicationStatus || row <= 1) return

    const newValue = String(e.value ?? "").toLowerCase().trim()

    if (newValue === "approved") {
        const email     = sheet.getRange(row, COL.email).getValue()
        const firstName = sheet.getRange(row, COL.firstName).getValue()

        // Update Member Status and Approved At
        sheet.getRange(row, COL.memberStatus).setValue("payment_pending")
        sheet.getRange(row, COL.approvedAt).setValue(new Date().toISOString())

        // Send payment email with both plan links
        MailApp.sendEmail({
            to:       email,
            subject:  "Your Elite Spaces access is approved",
            htmlBody: paymentEmail(firstName, email),
        })
    }
    // rejected → do nothing (no email sent)
}

// ── MANUAL BYPASS ─────────────────────────────────────────────────────────────
// Grant access without payment — for yourself or specific people.
// Call via browser: WEBHOOK_URL?action=bypass&email=EMAIL&plan=monthly&secret=YOUR_SECRET

function handleBypass(params) {
    if (params.secret !== BYPASS_SECRET) {
        return jsonResponse({ result: "unauthorized" })
    }

    const email = params.email.toLowerCase().trim()
    const plan = params.plan || "monthly"
    const result = findRowByEmail(email)

    if (!result) {
        return jsonResponse({ result: "email_not_found", message: "No application found. Add the person to the sheet first." })
    }

    const { row } = result
    const status = plan === "founding" ? "founding_member" : "monthly_member"

    updateCell(row, COL.status, status)
    updateCell(row, COL.plan, plan)
    updateCell(row, COL.paymentDate, new Date())
    updateCell(row, COL.notes, "Manual bypass — no payment")

    const firstName = result.data[COL.firstName - 1]
    MailApp.sendEmail({
        to: email,
        subject: "Welcome to Elite Spaces",
        htmlBody: welcomeEmail(firstName)
    })

    return jsonResponse({ result: "success", status: status, email: email })
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────

function handleLoginGet(params) {
    const email = params.email.toLowerCase().trim()
    const result = findRowByEmail(email)

    if (!result) {
        return jsonResponse({ result: "not_found" })
    }

    const status = result.data[COL.memberStatus - 1]
    const validStatuses = ["active", "cancelling"]

    if (!validStatuses.includes(status)) {
        return jsonResponse({ result: "not_member", status: status })
    }

    const token = generateToken()
    const expiry = new Date(Date.now() + 15 * 60 * 1000)

    updateCell(result.row, COL.loginToken, token)
    updateCell(result.row, COL.tokenExpiry, expiry.toISOString())

    const firstName = result.data[COL.firstName - 1]
    const loginUrl = `${SITE_URL}#token=${token}&email=${encodeURIComponent(email)}`

    MailApp.sendEmail({
        to: email,
        subject: "Your Elite Spaces sign-in link",
        htmlBody: loginEmail(firstName, loginUrl)
    })

    return jsonResponse({ result: "login_email_sent" })
}

// ── VERIFY TOKEN ──────────────────────────────────────────────────────────────

function handleVerifyGet(params) {
    const email = params.email.toLowerCase().trim()
    const token = params.token

    const result = findRowByEmail(email)
    if (!result) return jsonResponse({ result: "not_found" })

    const storedToken = result.data[COL.loginToken - 1]
    const expiry = new Date(result.data[COL.tokenExpiry - 1])
    const now = new Date()

    if (storedToken !== token) {
        return jsonResponse({ result: "invalid_token" })
    }

    if (now > expiry) {
        return jsonResponse({ result: "token_expired" })
    }

    updateCell(result.row, COL.loginToken, "")
    updateCell(result.row, COL.tokenExpiry, "")

    return jsonResponse({
        result: "success",
        firstName: result.data[COL.firstName - 1],
        email: email,
        plan: result.data[COL.plan - 1],
        subscriptionId: result.data[COL.stripeSubscriptionId - 1],
    })
}

// ── STRIPE WEBHOOK ────────────────────────────────────────────────────────────

function handleStripeWebhook(data) {
    const email = (data.email || "").toLowerCase().trim()
    const result = findRowByEmail(email)
    if (!result) return jsonResponse({ result: "email_not_found" })

    const { row } = result

    if (data.event === "checkout_completed") {
        updateCell(row, COL.memberStatus,         "active")
        updateCell(row, COL.stripeCustomerId,     data.customerId     || "")
        updateCell(row, COL.stripeSubscriptionId, data.subscriptionId || "")
        updateCell(row, COL.plan,                 data.plan           || "monthly")
        updateCell(row, COL.paymentDate,          new Date())

        const firstName = result.data[COL.firstName - 1]
        MailApp.sendEmail({
            to:       email,
            subject:  "Welcome to Elite Spaces",
            htmlBody: welcomeEmail(firstName),
        })
    }

    if (data.event === "subscription_cancelled") {
        updateCell(row, COL.memberStatus, "cancelled")
        updateCell(row, COL.cancelledAt,  new Date())
    }

    if (data.event === "payment_failed") {
        updateCell(row, COL.memberStatus, "payment_failed")
        const firstName = result.data[COL.firstName - 1]
        MailApp.sendEmail({
            to:       email,
            subject:  "Payment issue — Elite Spaces",
            htmlBody: paymentFailedEmail(firstName),
        })
    }

    return jsonResponse({ result: "success" })
}

// ── CANCELLATION ──────────────────────────────────────────────────────────────

function handleCancel(data) {
    const email = (data.email || "").toLowerCase().trim()
    const result = findRowByEmail(email)
    if (!result) return jsonResponse({ result: "not_found" })

    updateCell(result.row, COL.memberStatus, "cancelling")
    updateCell(result.row, COL.cancelledAt,  new Date())

    const firstName = result.data[COL.firstName - 1]
    MailApp.sendEmail({
        to:       email,
        subject:  "Cancellation confirmed — Elite Spaces",
        htmlBody: cancellationEmail(firstName),
    })

    return jsonResponse({ result: "cancellation_received" })
}

// ── EMAIL TEMPLATES ───────────────────────────────────────────────────────────

function emailWrapper(content) {
    return `
        <div style="font-family:'Georgia',serif;max-width:480px;margin:0 auto;padding:48px 32px;background:#F7F5F0;color:#3d2b20;">
            <p style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#8a8580;margin-bottom:32px;">Elite Spaces &nbsp;·&nbsp; New York City</p>
            ${content}
            <div style="border-top:0.5px solid #C8C5BC;padding-top:24px;margin-top:40px;">
                <p style="font-size:11px;letter-spacing:0.12em;color:#8a8580;margin:0;">Elite Spaces &nbsp;·&nbsp; elitespaces.nyc</p>
            </div>
        </div>
    `
}

function approvalConfirmationEmail(firstName) {
    return emailWrapper(`
        <p style="font-size:22px;font-weight:300;font-style:italic;line-height:1.5;margin-bottom:24px;">Hi ${firstName},</p>
        <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-bottom:20px;">Thank you for requesting access to Elite Spaces. We review each application personally and will be in touch within one week.</p>
        <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;">In the meantime, follow along on <a href="${TIKTOK_URL}" style="color:#3d2b20;">TikTok</a> for a preview of what's inside.</p>
    `)
}

function paymentEmail(firstName, email) {
    return emailWrapper(`
        <p style="font-size:22px;font-weight:300;font-style:italic;line-height:1.5;margin-bottom:24px;">Hi ${firstName},</p>
        <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-bottom:32px;">Your application has been approved. Choose your membership below to unlock your personal calendar.</p>
        <div style="border:0.5px solid #C8C5BC;padding:24px;margin-bottom:16px;text-align:center;">
            <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#8a8580;margin-bottom:8px;">Monthly</p>
            <p style="font-size:28px;font-weight:300;color:#3d2b20;margin-bottom:4px;">$12</p>
            <p style="font-size:11px;color:#8a8580;margin-bottom:16px;">per month · cancel anytime</p>
            <a href="${STRIPE_MONTHLY_LINK}?prefilled_email=${encodeURIComponent(email)}" style="display:inline-block;background:#3d2b20;color:#F7F5F0;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;padding:14px 32px;text-decoration:none;">Choose Monthly</a>
        </div>
        <div style="border:0.5px solid #3d2b20;padding:24px;text-align:center;">
            <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#8a8580;margin-bottom:8px;">Founding Member</p>
            <p style="font-size:28px;font-weight:300;color:#3d2b20;margin-bottom:4px;">$99</p>
            <p style="font-size:11px;color:#8a8580;margin-bottom:16px;">per year · locked-in rate forever</p>
            <a href="${STRIPE_FOUNDING_LINK}?prefilled_email=${encodeURIComponent(email)}" style="display:inline-block;background:#3d2b20;color:#F7F5F0;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;padding:14px 32px;text-decoration:none;">Choose Founding</a>
        </div>
    `)
}

function welcomeEmail(firstName) {
    return emailWrapper(`
        <p style="font-size:22px;font-weight:300;font-style:italic;line-height:1.5;margin-bottom:24px;">Welcome, ${firstName}.</p>
        <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-bottom:32px;">Your membership is active. Sign in below to access your personal calendar.</p>
        <div style="text-align:center;">
            <a href="${SITE_URL}" style="display:inline-block;background:#3d2b20;color:#F7F5F0;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;padding:14px 32px;text-decoration:none;">Access My Calendar</a>
        </div>
    `)
}

function loginEmail(firstName, loginUrl) {
    return emailWrapper(`
        <p style="font-size:22px;font-weight:300;font-style:italic;line-height:1.5;margin-bottom:24px;">Hi ${firstName},</p>
        <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-bottom:32px;">Click below to sign in to your calendar. This link expires in 15 minutes.</p>
        <div style="text-align:center;margin-bottom:32px;">
            <a href="${loginUrl}" style="display:inline-block;background:#3d2b20;color:#F7F5F0;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;padding:14px 32px;text-decoration:none;">Sign In to Elite Spaces</a>
        </div>
        <p style="font-size:11px;color:#8a8580;text-align:center;">If you didn't request this link, you can safely ignore this email.</p>
    `)
}

function cancellationEmail(firstName) {
    return emailWrapper(`
        <p style="font-size:22px;font-weight:300;font-style:italic;line-height:1.5;margin-bottom:24px;">Hi ${firstName},</p>
        <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-bottom:20px;">Your cancellation has been received. You'll retain access until the end of your current billing period.</p>
        <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;">We hope to see you back in the future.</p>
    `)
}

function paymentFailedEmail(firstName) {
    return emailWrapper(`
        <p style="font-size:22px;font-weight:300;font-style:italic;line-height:1.5;margin-bottom:24px;">Hi ${firstName},</p>
        <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-bottom:32px;">We had trouble processing your payment. Please update your payment method to keep your access active.</p>
        <div style="text-align:center;">
            <a href="${SITE_URL}" style="display:inline-block;background:#3d2b20;color:#F7F5F0;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;padding:14px 32px;text-decoration:none;">Update Payment</a>
        </div>
    `)
}

// ── EVENTS — HELPERS ─────────────────────────────────────────────────────────

/**
 * Parse a date string from the Events sheet into {date, day, fullDate}.
 * Handles formats like "May 7, 2026", "May 13-17, 2026", "Opens May 10, 2026 (through...)"
 */
function parseEventDate_(dateStr) {
    if (!dateStr) return { date: null, day: null, fullDate: null }
    const match = dateStr.match(/([A-Za-z]+)\s+(\d+)(?:[–\-]\d+)?,?\s+(\d{4})/)
    if (!match) return { date: null, day: null, fullDate: null }
    const parsed = new Date(`${match[1]} ${match[2]}, ${match[3]}`)
    if (isNaN(parsed.getTime())) return { date: null, day: null, fullDate: null }
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    return {
        date:     parsed.getDate(),
        day:      days[parsed.getDay()],
        fullDate: parsed
    }
}

/**
 * Auto-assign categories and isFree for a new event based on name + description.
 */
function inferCategories_(name, description) {
    const text = (name + " " + description).toLowerCase()
    const cats = []
    if (/gala|benefit|dinner|fundraiser|black.tie/.test(text))                                                                                    cats.push("gala")
    if (/beauty|skincare|fragrance|makeup|cosmetic|sephora|ulta|lanc[oô]me|fenty|k-beauty|pop-up.*beauty|beauty.*pop-up/.test(text))             cats.push("beauty")
    if (/pop.?up|activation|launch|opening|showroom|store/.test(text))                                                                           cats.push("popup")
    if (/art|museum|gallery|exhibition|moma|met |guggenheim|frieze|performance|theater|theatre|ballet|opera|concert/.test(text))                 cats.push("art")
    if (/industry|trade show|b2b|supplier|professional|summit/.test(text))                                                                       cats.push("industry")
    const isFree = /\bfree\b|no cost|complimentary|open to (all|public)/.test(text)
    if (isFree) cats.push("free")
    return {
        categories: cats.join(",") || "art",
        isFree:     isFree
    }
}

/**
 * Read all rows from the Events sheet and return as an array of objects.
 */
function getEventsSheetRows_() {
    try {
        const ss    = SpreadsheetApp.openById(EVENTS_SHEET_ID)
        const sheet = ss.getActiveSheet()
        const data  = sheet.getDataRange().getValues()
        if (data.length < 2) return []
        const headers = data[0].map(h => h.toString().trim())
        return data.slice(1).map((row, i) => {
            const obj = {}
            headers.forEach((h, j) => { obj[h] = row[j] })
            obj._rowIndex = i + 2 // 1-indexed, offset for header
            return obj
        })
    } catch (err) {
        Logger.log("getEventsSheetRows_ error: " + err.message)
        return []
    }
}

// ── EVENTS — HANDLERS ─────────────────────────────────────────────────────────

/**
 * getEvents — returns all Published or Approved events for the current calendar month.
 * Called by the website CalendarView on page load.
 */
function handleGetEvents(_data) {
    const rows         = getEventsSheetRows_()
    const now          = new Date()
    const currentMonth = now.getMonth()
    const currentYear  = now.getFullYear()
    const events       = []
    let id = 1

    rows.forEach(row => {
        const status = (row["Status"] || "").toString().trim()
        if (status !== "Published" && status !== "Approved") return

        const parsed = parseEventDate_(row["Date"] ? row["Date"].toString() : "")
        if (!parsed.fullDate) return
        if (parsed.fullDate.getMonth() !== currentMonth || parsed.fullDate.getFullYear() !== currentYear) return

        const categoriesRaw = (row["Categories"] || "").toString().trim()
        const isFreeRaw     = row["isFree"]
        const isFree        = isFreeRaw === true || isFreeRaw === "true" || isFreeRaw === "TRUE"

        let cats = categoriesRaw ? categoriesRaw.split(",").map(c => c.trim()).filter(Boolean) : []
        if (isFree && !cats.includes("free")) cats.push("free")

        const vibeScore = parseInt((row["Vibe Score"] || "0").toString()) || 0

        events.push({
            id:          id++,
            date:        parsed.date,
            day:         parsed.day,
            name:        (row["Event Name"]  || "").toString(),
            venue:       (row["Location"]    || "").toString(),
            time:        (row["Time"]        || "").toString(),
            description: (row["Description"] || "").toString(),
            categories:  cats,
            isFree:      isFree,
            vibeScore:   vibeScore
        })
    })

    events.sort((a, b) => (a.date || 0) - (b.date || 0))

    return ContentService
        .createTextOutput(JSON.stringify({ events: events, month: currentMonth + 1, year: currentYear }))
        .setMimeType(ContentService.MimeType.JSON)
}

/**
 * updateEvents — upserts events from the weekly pipeline.
 * Existing events: updates mutable fields but PRESERVES Status.
 * New events: appends with Status = "Pending Review".
 */
function handleUpdateEvents(data) {
    const incomingEvents = data.events || []
    if (!incomingEvents.length) {
        return ContentService
            .createTextOutput(JSON.stringify({ result: "no_events" }))
            .setMimeType(ContentService.MimeType.JSON)
    }

    const ss           = SpreadsheetApp.openById(EVENTS_SHEET_ID)
    const sheet        = ss.getActiveSheet()
    const existingRows = getEventsSheetRows_()

    const existingMap = {}
    existingRows.forEach(row => {
        const key = (row["Event Name"] || "").toString().toLowerCase().trim()
        existingMap[key] = row
    })

    let added = 0, updated = 0

    incomingEvents.forEach(ev => {
        const key      = (ev["Event Name"] || "").toLowerCase().trim()
        const existing = existingMap[key]

        if (existing) {
            // Update mutable fields only — preserve Status
            // Column indexes (1-indexed): Time=3, Location=4, Description=5, Notes=9, Categories=10, isFree=11
            const rowIdx = existing._rowIndex
            sheet.getRange(rowIdx, 3).setValue(ev["Time"]        || existing["Time"])
            sheet.getRange(rowIdx, 4).setValue(ev["Location"]    || existing["Location"])
            sheet.getRange(rowIdx, 5).setValue(ev["Description"] || existing["Description"])
            if (ev["Notes"])              sheet.getRange(rowIdx, 9).setValue(ev["Notes"])
            if (ev["Categories"])         sheet.getRange(rowIdx, 10).setValue(ev["Categories"])
            if (ev["isFree"] !== undefined) sheet.getRange(rowIdx, 11).setValue(ev["isFree"])
            updated++
        } else {
            // New event — append row
            const inferred = inferCategories_(ev["Event Name"] || "", ev["Description"] || "")
            const cats   = ev["Categories"] || inferred.categories
            const isFree = ev["isFree"] !== undefined ? ev["isFree"] : inferred.isFree
            sheet.appendRow([
                ev["Event Name"]  || "",
                ev["Date"]        || "",
                ev["Time"]        || "",
                ev["Location"]    || "",
                ev["Description"] || "",
                ev["Source URL"]  || "",
                ev["Vibe Score"]  || "",
                "Pending Review",
                ev["Notes"]       || "",
                cats,
                isFree
            ])
            added++
        }
    })

    SpreadsheetApp.flush()

    return ContentService
        .createTextOutput(JSON.stringify({ result: "success", added: added, updated: updated }))
        .setMimeType(ContentService.MimeType.JSON)
}

/**
 * publishApproved — flips all Approved events to Published.
 * Called by the monthly publish task on the first Sunday of each month.
 */
function handlePublishApproved(_data) {
    const ss        = SpreadsheetApp.openById(EVENTS_SHEET_ID)
    const sheet     = ss.getActiveSheet()
    const rows      = getEventsSheetRows_()
    const published = []

    rows.forEach(row => {
        if ((row["Status"] || "").toString().trim() === "Approved") {
            // Status column is column H (index 8, 1-indexed)
            sheet.getRange(row._rowIndex, 8).setValue("Published")
            published.push(row["Event Name"] || "")
        }
    })

    SpreadsheetApp.flush()

    return ContentService
        .createTextOutput(JSON.stringify({ result: "success", published: published, count: published.length }))
        .setMimeType(ContentService.MimeType.JSON)
}

// ── TEST FUNCTIONS ────────────────────────────────────────────────────────────
// Run these from the Apps Script editor to test without the live form.

function testNewApplication() {
    const fakeEvent = {
        postData: {
            contents: JSON.stringify({
                firstName: "Danielle",
                lastName: "Black",
                email: ADMIN_EMAIL,
                source: "test"
            })
        }
    }
    doPost(fakeEvent)
}

function testLogin() {
    handleLoginGet({ email: ADMIN_EMAIL })
}

function testBypass() {
    handleBypass({
        email: ADMIN_EMAIL,
        plan: "founding",
        secret: BYPASS_SECRET
    })
}
