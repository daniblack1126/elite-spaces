// Elite Spaces NYC — Google Apps Script
// Handles: form submissions, approval emails, Stripe webhooks, magic link login
// Save this file as AppScript.gs in your project repo for reference

const SHEET_NAME = "Sheet1"
const ADMIN_EMAIL = "daniblackbeauty@gmail.com"
const SITE_URL = "https://elitespaces.nyc"
const TIKTOK_URL = "https://www.tiktok.com/@daniblackbeauty"
const STRIPE_MONTHLY_LINK = "https://buy.stripe.com/test_9B66oGfxd4FU7Fe0kt6Na00"
const STRIPE_FOUNDING_LINK = "https://buy.stripe.com/test_eVq28qcl1c8mgbKebj6Na01"
const BYPASS_SECRET = "elitespaces2026"

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

// ── doPost — handles form submissions, Stripe webhooks, cancellation ──────────

function doPost(e) {
    const data = JSON.parse(e.postData.contents)

    if (data.action === "cancel")          return handleCancel(data)
    if (data.action === "stripe_webhook")  return handleStripeWebhook(data)

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
