// Elite Spaces NYC — Google Apps Script
// Handles: form submissions, approval emails, Stripe webhooks, magic link login, events pipeline, drip sequence
// Last Updated: November 2026
// Source of truth: github.com/daniblack1126/elite-spaces/apps-script/Code.gs. Paste this whole file into the Apps Script editor.

// ── 1. CONSTANTS & CONFIG ─────────────────────────────────────────────────────

const SHEET_NAME           = "Members"
const ADMIN_EMAIL          = "daniblackbeauty@gmail.com"
const SITE_URL             = "https://elitespaces.nyc"
const TIKTOK_URL           = "https://www.tiktok.com/@daniblackbeauty"
const STRIPE_MONTHLY_LINK  = "https://buy.stripe.com/00w28q4LygY1de68wM4Ja02"
const STRIPE_FOUNDING_LINK = "https://buy.stripe.com/4gM5kCgugdLP5LE3cs4Ja00"
// Secrets live in Project Settings > Script Properties, not in code (this file is in a public GitHub repo).
//   BYPASS_SECRET  - for free-access links (?action=bypass&secret=...). Not set = bypass links are turned off.
//   SITE_SECRET    - must match APPS_SCRIPT_SECRET in Vercel. Once set, only the website can mark payments / cancellations.
const BYPASS_SECRET        = PropertiesService.getScriptProperties().getProperty("BYPASS_SECRET")
const SITE_SECRET          = PropertiesService.getScriptProperties().getProperty("SITE_SECRET")
const FROM_EMAIL           = "info@elitespaces.nyc"
const FROM_NAME            = "Elite Spaces"
const EVENTS_SHEET_ID      = "1zrapP4xBWhlikvhGGPXiFjN-hDqzHUQs2bT8F-WBBr8"
const STRIPE_TRIAL_COUPON  = "ELITEMONTH"

const DRIP_DAYS = {
  reminder: 2,
  events:   5,
  feedback: 10,
  referral: 14,
  offer:    21,
  expire:   31
}

const COL = {
  timestamp:            1,
  firstName:            2,
  lastName:             3,
  email:                4,
  source:               5,
  handle:               6,
  applicationStatus:    7,
  memberStatus:         8,
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
  dripStage:            20,
  referredBy:           21,
  referralStatus:       22,
}

const PIPELINE_CONFIG = {
  RESULTS_PER_QUERY:     10,      // Brave "count" (max 20)
  MAX_PAGES_TO_FETCH:    24,      // event pages opened for full detail (fetched in parallel now)
  PAGE_CHAR_LIMIT:       6000,    // visible text per page sent to Claude (was 2800, which cut roundup pages off before most dates)
  JSONLD_CHAR_LIMIT:     2500,    // schema.org data per page
  MAX_FILL_IN_EVENTS:    25,      // second pass: events with a missing day/time/venue that get their own page re-read
  FILL_IN_EXCERPT_CHARS: 3000,    // text kept around the event's name on its source page for that second pass
  RUNTIME_BUDGET_MS:     250000,  // skip the second pass if the run is already past this (Apps Script hard cap is 6 min)
  MIN_SCORE_TO_INCLUDE:  4,       // raise to 6 to cut borderline events in code
  DROP_PAST_EVENTS:      true,    // discard events that already ended
  REQUIRE_EXACT_DATE:    true,    // events without an exact day ("September 2026", "Summer 2026") are NOT added; they are listed in the email instead and retried next run
  TIDY_SHEET_AFTER_RUN:  true,    // after each run: plain-text dates/times in one format, clean categories, rows sorted by date
  ARCHIVE_AFTER_DAYS:    45,      // archivePastEvents() moves events that ended more than this many days ago to an "Archive" tab
  CLAUDE_MODEL:          "claude-sonnet-5",
  CLAUDE_MAX_TOKENS:     32000,
  USER_AGENT:            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"
}

// ── 2. UTILITIES ──────────────────────────────────────────────────────────────

function getSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME)
}

function findRowByEmail(email) {
  const sheet = getSheet()
  const data  = sheet.getDataRange().getValues()
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

// ── 3. ROUTERS ────────────────────────────────────────────────────────────────

function doGet(e) {
  const action = e.parameter.action
  if (action === "login")  return handleLoginGet(e.parameter)
  if (action === "verify") return handleVerifyGet(e.parameter)
  if (action === "bypass") return handleBypass(e.parameter)
  return jsonResponse({ result: "ok" })
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents)

  // Read-only and public actions
  if (data.action === "getEvents") return handleGetEvents(data)
  if (data.action === "apply")     return handleNewApplication(data)

  // Everything below changes member or event data, so it must come from the website
  if (SITE_SECRET && data.secret !== SITE_SECRET) return jsonResponse({ result: "unauthorized" })

  if (data.action === "stripe_webhook")  return handleSiteStripeEvent(data)   // sent by elitespaces.nyc/api/stripe
  if (data.action === "cancel")          return handleCancel(data)
  if (data.action === "updateEvents")    return handleUpdateEvents(data)
  if (data.action === "publishApproved") return handlePublishApproved(data)
  if (data.type)                         return handleStripeWebhook(data)     // old path: Stripe posting straight here

  // Old website versions posted applications with no action
  if (data.email && data.firstName && !data.action) return handleNewApplication(data)
  return jsonResponse({ result: "unknown_action" })
}

// ── 4. CORE REQUEST HANDLERS ──────────────────────────────────────────────────

function handleNewApplication(data) {
  const sheet = getSheet()
  const now   = new Date()
  data.email  = String(data.email || "").toLowerCase().trim()
  if (!data.email) return jsonResponse({ result: "error", message: "email required" })

  // Same email applying twice: don't add a second row (it would shadow the first in every lookup)
  if (findRowByEmail(data.email)) {
    GmailApp.sendEmail(ADMIN_EMAIL, `Repeat Elite Spaces application — ${data.email}`,
      `${data.firstName || ""} (${data.email}) submitted the access form again. No new row was added.`,
      { from: FROM_EMAIL, name: FROM_NAME })
    return jsonResponse({ result: "success", note: "already_applied" })
  }

  sheet.appendRow([
    now,
    data.firstName || "",
    data.lastName  || "",
    data.email     || "",
    data.source    || "",
    data.handle    || "",
    "pending",
    "",
    "",
    "",
    "",
    "",
    "",
    now,
    "",
    "",
    "",
    "",
    "",
  ])

  GmailApp.sendEmail(data.email, "You're on the list — Elite Spaces", "", {
    from:     FROM_EMAIL,
    name:     FROM_NAME,
    htmlBody: approvalConfirmationEmail(data.firstName),
  })

  GmailApp.sendEmail(ADMIN_EMAIL,
    `New Elite Spaces application — ${data.firstName} ${data.lastName}`,
    `New application:\n\nName: ${data.firstName} ${data.lastName}\nEmail: ${data.email}\nHandle: ${data.handle || "—"}\nSource: ${data.source}\nTime: ${now}\n\nSet status to "approved" in column G of the sheet to trigger the payment email.`,
    { from: FROM_EMAIL, name: FROM_NAME }
  )

  return jsonResponse({ result: "success" })
}

function handleBypass(params) {
  if (!BYPASS_SECRET || params.secret !== BYPASS_SECRET) {
    return jsonResponse({ result: "unauthorized" })
  }

  const email  = params.email.toLowerCase().trim()
  const plan   = params.plan || "monthly"
  const result = findRowByEmail(email)

  if (!result) {
    return jsonResponse({ result: "email_not_found", message: "No application found. Add the person to the sheet first." })
  }

  const { row } = result
  const status  = "active"   // login only accepts active / cancelling

  updateCell(row, COL.memberStatus, status)
  updateCell(row, COL.plan,         plan)
  updateCell(row, COL.paymentDate,  new Date())
  updateCell(row, COL.notes,        "Manual bypass — no payment")

  const firstName = result.data[COL.firstName - 1]
  GmailApp.sendEmail(email, "Welcome to Elite Spaces", "", {
    from:     FROM_EMAIL,
    name:     FROM_NAME,
    htmlBody: welcomeEmail(firstName),
  })

  return jsonResponse({ result: "success", status: status, email: email })
}

function handleLoginGet(params) {
  const email  = params.email.toLowerCase().trim()
  const result = findRowByEmail(email)

  if (!result) return jsonResponse({ result: "not_found" })

  const status        = result.data[COL.memberStatus - 1]
  const validStatuses = ["active", "cancelling", "monthly_member", "founding_member"]  // last two: older bypass rows

  if (!validStatuses.includes(status)) {
    return jsonResponse({ result: "not_member", status: status })
  }

  const token  = generateToken()
  const expiry = new Date(Date.now() + 15 * 60 * 1000)

  updateCell(result.row, COL.loginToken,  token)
  updateCell(result.row, COL.tokenExpiry, expiry.toISOString())

  const firstName = result.data[COL.firstName - 1]
  const loginUrl  = `${SITE_URL}#token=${token}&email=${encodeURIComponent(email)}`

  GmailApp.sendEmail(email, "Your Elite Spaces sign-in link", "", {
    from:     FROM_EMAIL,
    name:     FROM_NAME,
    htmlBody: loginEmail(firstName, loginUrl),
  })

  return jsonResponse({ result: "login_email_sent" })
}

function handleVerifyGet(params) {
  const email  = params.email.toLowerCase().trim()
  const token  = params.token
  const result = findRowByEmail(email)

  if (!result) return jsonResponse({ result: "not_found" })

  const storedToken = result.data[COL.loginToken - 1]
  const expiry      = new Date(result.data[COL.tokenExpiry - 1])
  const now         = new Date()

  if (storedToken !== token) return jsonResponse({ result: "invalid_token" })
  if (now > expiry)          return jsonResponse({ result: "token_expired" })

  updateCell(result.row, COL.loginToken,  "")
  updateCell(result.row, COL.tokenExpiry, "")

  return jsonResponse({
    result:         "success",
    firstName:      result.data[COL.firstName - 1],
    email:          email,
    plan:           result.data[COL.plan - 1],
    subscriptionId: result.data[COL.stripeSubscriptionId - 1],
  })
}

// The website verifies Stripe's signature, then sends { action: "stripe_webhook", event, email, ... } here.
function handleSiteStripeEvent(data) {
  const map = {
    checkout_completed:     "checkout.session.completed",
    subscription_cancelled: "customer.subscription.deleted",
    payment_failed:         "invoice.payment_failed",
  }
  return applyStripeEvent_(map[data.event] || "", (data.email || "").toLowerCase().trim(), {
    customer:     data.customerId     || "",
    subscription: data.subscriptionId || "",
    plan:         data.plan           || "monthly",
  })
}

// Old path: a raw Stripe event posted straight to this script (no signature check possible here)
function handleStripeWebhook(data) {
  const obj = data.data && data.data.object ? data.data.object : {}
  const email = (
    obj.customer_email ||
    (obj.customer_details && obj.customer_details.email) ||
    ""
  ).toLowerCase().trim()
  return applyStripeEvent_(data.type, email, {
    customer:     obj.customer     || "",
    subscription: obj.subscription || "",
    plan:         obj.amount_total <= 900 ? "monthly" : "founding",
  })
}

function applyStripeEvent_(eventType, email, info) {
  const result = findRowByEmail(email)
  if (!result) {
    GmailApp.sendEmail(ADMIN_EMAIL, "Elite Spaces — Stripe event for unknown email",
      `Stripe sent "${eventType}" for ${email || "(no email)"}, but that email isn't in the Members sheet. ` +
      `They may have paid with a different email than they applied with. Fix the email in the sheet, then set Member Status to "active".`)
    return jsonResponse({ result: "email_not_found", email: email })
  }

  const { row } = result

  if (eventType === "checkout.session.completed") {
    const plan = info.plan
    updateCell(row, COL.memberStatus,         "active")
    updateCell(row, COL.stripeCustomerId,     info.customer)
    updateCell(row, COL.stripeSubscriptionId, info.subscription)
    updateCell(row, COL.plan,                 plan)
    updateCell(row, COL.paymentDate,          new Date())

    const firstName = result.data[COL.firstName - 1]
    GmailApp.sendEmail(email, "Welcome to Elite Spaces", "", {
      from:     FROM_EMAIL,
      name:     FROM_NAME,
      htmlBody: welcomeEmail(firstName),
    })

    const referredByEmail = result.data[COL.referredBy - 1]
    if (referredByEmail) {
      updateCell(row, COL.referralStatus, "converted")
      const referrerResult = findRowByEmail(referredByEmail)
      if (referrerResult) {
        const referrerFirstName = referrerResult.data[COL.firstName - 1]
        const referrerRow       = referrerResult.row
        updateCell(referrerRow, COL.referralStatus, "rewarded")
        const referrerBody = emailWrapper(`
          <p style="font-size:22px;font-weight:300;font-style:italic;line-height:1.5;margin-bottom:24px;">Hi ${referrerFirstName},</p>
          <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-bottom:16px;">Your referral just signed up. Thank you for bringing them into the community.</p>
          <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-bottom:32px;">Here is your gift: use code <strong>${STRIPE_TRIAL_COUPON}</strong> at checkout for your first month free.</p>
          <div style="text-align:center;margin-bottom:32px;">
            <a href="${STRIPE_MONTHLY_LINK}?prefilled_email=${encodeURIComponent(referredByEmail)}" style="display:inline-block;background:#3d2b20;color:#F7F5F0;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;padding:14px 32px;text-decoration:none;">Become a Member</a>
          </div>
          <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-top:32px;">xoxo, Dani</p>
        `)
        GmailApp.sendEmail(referredByEmail, "Your referral signed up. Here is your gift.", "", {
          from:     FROM_EMAIL,
          name:     FROM_NAME,
          htmlBody: referrerBody,
        })
      }
    }
  }

  if (eventType === "customer.subscription.deleted") {
    updateCell(row, COL.memberStatus, "cancelled")
    updateCell(row, COL.cancelledAt,  new Date())
  }

  if (eventType === "invoice.payment_failed") {
    updateCell(row, COL.memberStatus, "payment_failed")
    const firstName = result.data[COL.firstName - 1]
    GmailApp.sendEmail(email, "Payment issue — Elite Spaces", "", {
      from:     FROM_EMAIL,
      name:     FROM_NAME,
      htmlBody: paymentFailedEmail(firstName),
    })
  }

  return jsonResponse({ result: "success" })
}

function handleCancel(data) {
  const email  = (data.email || "").toLowerCase().trim()
  const result = findRowByEmail(email)
  if (!result) return jsonResponse({ result: "not_found" })

  updateCell(result.row, COL.memberStatus, "cancelling")
  updateCell(result.row, COL.cancelledAt,  new Date())

  const firstName = result.data[COL.firstName - 1]
  GmailApp.sendEmail(email, "Cancellation confirmed — Elite Spaces", "", {
    from:     FROM_EMAIL,
    name:     FROM_NAME,
    htmlBody: cancellationEmail(firstName),
  })

  return jsonResponse({ result: "cancellation_received" })
}

// ── 5. TRIGGERS ───────────────────────────────────────────────────────────────
// To activate: Apps Script editor > Triggers (clock icon) > Add trigger
//   Function: onEdit | Event source: From spreadsheet | Event type: On edit

function onEdit(e) {
  const sheet     = e.source.getActiveSheet()
  const editedCol = e.range.getColumn()
  const row       = e.range.getRow()
  const newValue  = String(e.value ?? "").trim()

  if (sheet.getName() !== SHEET_NAME) return
  if (row <= 1) return

  // Approval flow
  if (editedCol === COL.applicationStatus) {
    if (newValue.toLowerCase() !== "approved") return

    const email      = sheet.getRange(row, COL.email).getValue()
    const firstName  = sheet.getRange(row, COL.firstName).getValue()
    const referredBy = sheet.getRange(row, COL.referredBy).getValue()

    sheet.getRange(row, COL.memberStatus).setValue("payment_pending")
    sheet.getRange(row, COL.approvedAt).setValue(new Date().toISOString())

    // Skip payment email for referred members — referral invite flow handles their outreach
    if (referredBy) return

    GmailApp.sendEmail(email, "Your Elite Spaces access is approved", "", {
      from:     FROM_EMAIL,
      name:     FROM_NAME,
      htmlBody: paymentEmail(firstName, email),
    })

    return
  }

  // Referral invite flow — fires when col 21 (Referred By) is filled in
  if (editedCol === COL.referredBy && newValue) {
    Logger.log("Referral block triggered")
    const data = sheet.getRange(row, 1, 1, 22).getValues()[0]

    const firstName       = data[COL.firstName - 1]
    const email           = data[COL.email - 1]
    const appStatus       = data[COL.applicationStatus - 1]
    const memberStatus    = data[COL.memberStatus - 1]
    const referredByEmail = newValue

    Logger.log("firstName: " + firstName)
    Logger.log("email: " + email)
    Logger.log("appStatus: " + appStatus)
    Logger.log("memberStatus: " + memberStatus)
    Logger.log("referredByEmail: " + referredByEmail)

    if (!firstName || !email)               { Logger.log("STOPPED: missing name or email"); return }
    if (appStatus !== "approved")           { Logger.log("STOPPED: appStatus is not approved, it is: " + appStatus); return }
    if (memberStatus !== "payment_pending") { Logger.log("STOPPED: memberStatus is not payment_pending, it is: " + memberStatus); return }

    const allData = sheet.getDataRange().getValues()
    let referrerFirstName = ""
    let referrerLastName  = ""

    for (let i = 1; i < allData.length; i++) {
      if (allData[i][COL.email - 1] === referredByEmail) {
        referrerFirstName = allData[i][COL.firstName - 1]
        referrerLastName  = allData[i][COL.lastName - 1]
        break
      }
    }

    Logger.log("referrerFirstName: " + referrerFirstName)
    Logger.log("referrerLastName: " + referrerLastName)

    if (!referrerFirstName) { Logger.log("STOPPED: referrer not found in sheet"); return }

    const inviteTemplate = referralInviteEmail_(firstName, email, referrerFirstName, referrerLastName)
    GmailApp.sendEmail(email, inviteTemplate.subject, "", {
      from:     FROM_EMAIL,
      name:     FROM_NAME,
      htmlBody: inviteTemplate.body,
    })
    Logger.log("Referral invite sent to: " + email)

    const referrerNotifyBody = emailWrapper(`
      <p style="font-size:22px;font-weight:300;font-style:italic;line-height:1.5;margin-bottom:24px;">Hi ${referrerFirstName},</p>
      <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-bottom:32px;">We just sent ${firstName} an invite to Elite Spaces. When they sign up, you'll both get your first month free. We'll be in touch!</p>
      <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;">Dani</p>
    `)

    GmailApp.sendEmail(referredByEmail, "Your Elite Spaces referral is on its way", "", {
      from:     FROM_EMAIL,
      name:     FROM_NAME,
      htmlBody: referrerNotifyBody,
    })
    Logger.log("Referrer notification sent to: " + referredByEmail)

    return
  }
}

// ── 6. EMAIL TEMPLATES — TRANSACTIONAL ───────────────────────────────────────

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
      <p style="font-size:28px;font-weight:300;color:#3d2b20;margin-bottom:4px;">$8.99</p>
      <p style="font-size:11px;color:#8a8580;margin-bottom:16px;">per month · cancel anytime</p>
      <a href="${STRIPE_MONTHLY_LINK}?prefilled_email=${encodeURIComponent(email)}" style="display:inline-block;background:#3d2b20;color:#F7F5F0;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;padding:14px 32px;text-decoration:none;">Choose Monthly</a>
    </div>
    <div style="border:0.5px solid #3d2b20;padding:24px;text-align:center;">
      <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#8a8580;margin-bottom:8px;">Yearly (Founding Member)</p>
      <p style="font-size:28px;font-weight:300;color:#3d2b20;margin-bottom:4px;">$86.00</p>
      <p style="font-size:11px;color:#8a8580;margin-bottom:16px;">per year · best rate</p>
      <a href="${STRIPE_FOUNDING_LINK}?prefilled_email=${encodeURIComponent(email)}" style="display:inline-block;background:#3d2b20;color:#F7F5F0;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;padding:14px 32px;text-decoration:none;">Choose Yearly</a>
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

// ── 7. EMAIL TEMPLATES — DRIP ─────────────────────────────────────────────────

function dripReminderEmail_(firstName, email) {
  const subject      = "You're in. Don't let it slip."
  const monthlyLink  = STRIPE_MONTHLY_LINK  + "?prefilled_email=" + encodeURIComponent(email)
  const foundingLink = STRIPE_FOUNDING_LINK + "?prefilled_email=" + encodeURIComponent(email)

  const body = emailWrapper(`
    <p style="font-size:22px;font-weight:300;font-style:italic;line-height:1.5;margin-bottom:24px;">Hi ${firstName},</p>
    <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-bottom:16px;">You were approved for Elite Spaces and your spot is still here waiting for you.</p>
    <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-bottom:32px;">This is for you if you're done settling for the same circles and want to be in the rooms where things actually happen. Curated events, a community that moves, and a social calendar that finally matches your ambition.</p>
    <p style="font-size:13px;font-weight:300;letter-spacing:0.08em;text-transform:uppercase;color:#5a5550;margin-bottom:24px;">Your membership is one step away.</p>
    <div style="text-align:center;margin-bottom:16px;">
      <a href="${monthlyLink}" style="display:inline-block;background:#3d2b20;color:#F7F5F0;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;padding:14px 32px;text-decoration:none;margin-bottom:12px;">Become a Monthly Member</a>
    </div>
    <div style="text-align:center;margin-bottom:32px;">
      <a href="${foundingLink}" style="display:inline-block;background:#3d2b20;color:#F7F5F0;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;padding:14px 32px;text-decoration:none;">Become an Annual Member (Founding Price)</a>
    </div>
    <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-top:32px;">xoxo, Dani</p>
  `)

  return { subject, body }
}

function dripEventsEmail_(firstName, email, events) {
  const subject      = "Sneak peek: what members accessed this month"
  const monthlyLink  = STRIPE_MONTHLY_LINK  + "?prefilled_email=" + encodeURIComponent(email)
  const foundingLink = STRIPE_FOUNDING_LINK + "?prefilled_email=" + encodeURIComponent(email)

  const eventCards = events.map(event => `
    <div style="border-top:1px solid #e8e2da;padding:24px 0;">
      <p style="font-size:15px;font-weight:400;color:#3d2b20;margin-bottom:6px;">${event.name}</p>
      <p style="font-size:12px;font-weight:300;letter-spacing:0.08em;text-transform:uppercase;color:#9a8f87;margin-bottom:12px;">${event.date} &middot; ${event.location}</p>
      <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-bottom:8px;">${event.description}</p>
      <p style="font-size:12px;font-weight:300;letter-spacing:0.06em;color:#9a8f87;">Vibe score: ${event.vibeScore}/10</p>
    </div>
  `).join("")

  const body = emailWrapper(`
    <p style="font-size:22px;font-weight:300;font-style:italic;line-height:1.5;margin-bottom:24px;">Hi ${firstName},</p>
    <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-bottom:8px;">Here's a sample of what Elite Spaces members got access to this month.</p>
    <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-bottom:32px;">These aren't events you find on Eventbrite.</p>
    <div style="margin-bottom:32px;">${eventCards}</div>
    <p style="font-size:13px;font-weight:300;letter-spacing:0.08em;text-transform:uppercase;color:#5a5550;margin-bottom:24px;">Members see the full list plus RSVP details.</p>
    <div style="text-align:center;margin-bottom:16px;">
      <a href="${monthlyLink}" style="display:inline-block;background:#3d2b20;color:#F7F5F0;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;padding:14px 32px;text-decoration:none;margin-bottom:12px;">Become a Monthly Member</a>
    </div>
    <div style="text-align:center;margin-bottom:32px;">
      <a href="${foundingLink}" style="display:inline-block;background:#3d2b20;color:#F7F5F0;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;padding:14px 32px;text-decoration:none;">Become an Annual Member (Founding Price)</a>
    </div>
    <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-top:32px;">xoxo, Dani</p>
  `)

  return { subject, body }
}

function dripFeedbackEmail_(firstName, email) {
  const subject = `Quick question, ${firstName}`

  const priceLink     = `mailto:info@elitespaces.nyc?subject=Feedback: Price&body=Hi Dani, the price isn't right for me right now.`
  const vibeLink      = `mailto:info@elitespaces.nyc?subject=Feedback: Events&body=Hi Dani, I'm not sure the events are my vibe.`
  const communityLink = `mailto:info@elitespaces.nyc?subject=Feedback: Community&body=Hi Dani, I need more than just events (community, networking).`
  const timingLink    = `mailto:info@elitespaces.nyc?subject=Feedback: Timing&body=Hi Dani, the timing just isn't great for me right now.`

  const body = emailWrapper(`
    <p style="font-size:22px;font-weight:300;font-style:italic;line-height:1.5;margin-bottom:24px;">Hi ${firstName},</p>
    <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-bottom:8px;">It's Dani. I noticed you haven't joined yet and just wanted to check in. No pitch, genuinely curious.</p>
    <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-bottom:24px;">What's holding you back? Is it one of these?</p>
    <div style="margin-bottom:32px;">
      <p style="margin-bottom:12px;"><a href="${priceLink}" style="font-size:14px;font-weight:300;color:#3d2b20;text-decoration:underline;">The price isn't right for me right now</a></p>
      <p style="margin-bottom:12px;"><a href="${vibeLink}" style="font-size:14px;font-weight:300;color:#3d2b20;text-decoration:underline;">I'm not sure the events are my vibe</a></p>
      <p style="margin-bottom:12px;"><a href="${communityLink}" style="font-size:14px;font-weight:300;color:#3d2b20;text-decoration:underline;">I need more than just events (community, networking)</a></p>
      <p style="margin-bottom:12px;"><a href="${timingLink}" style="font-size:14px;font-weight:300;color:#3d2b20;text-decoration:underline;">The timing just isn't great for me right now</a></p>
    </div>
    <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-bottom:32px;">Or just reply to this email and tell me directly. I read every response.</p>
    <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-top:32px;">Dani</p>
  `)

  return { subject, body }
}

function dripReferralEmail_(firstName, email) {
  const subject      = "Bring your people. You both get a month free."
  const monthlyLink  = STRIPE_MONTHLY_LINK  + "?prefilled_email=" + encodeURIComponent(email)
  const foundingLink = STRIPE_FOUNDING_LINK + "?prefilled_email=" + encodeURIComponent(email)

  const body = emailWrapper(`
    <p style="font-size:22px;font-weight:300;font-style:italic;line-height:1.5;margin-bottom:24px;">Hi ${firstName},</p>
    <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-bottom:16px;">We built Elite Spaces for a specific kind of person and we trust that you know exactly who in your life belongs here too.</p>
    <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-bottom:32px;">Here's the offer: refer a friend, and when they sign up, you both get your first month free. Just reply to this email with their name and email address. We'll take it from there.</p>
    <p style="font-size:13px;font-weight:300;line-height:1.9;color:#5a5550;margin-bottom:24px;">Or join now and invite them once you're in.</p>
    <div style="text-align:center;margin-bottom:16px;">
      <a href="${monthlyLink}" style="display:inline-block;background:#3d2b20;color:#F7F5F0;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;padding:14px 32px;text-decoration:none;margin-bottom:12px;">Become a Monthly Member</a>
    </div>
    <div style="text-align:center;margin-bottom:32px;">
      <a href="${foundingLink}" style="display:inline-block;background:#3d2b20;color:#F7F5F0;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;padding:14px 32px;text-decoration:none;">Become an Annual Member (Founding Price)</a>
    </div>
    <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-top:32px;">Dani</p>
  `)

  return { subject, body }
}

function dripOfferEmail_(firstName, email) {
  const subject = "A gift, if you want it"

  const expiryDate = new Date()
  expiryDate.setDate(expiryDate.getDate() + 10)
  expiryDate.setHours(23, 59, 0, 0)
  const expiryString = expiryDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })

  const monthlyLink = STRIPE_MONTHLY_LINK + "?prefilled_email=" + encodeURIComponent(email)

  const body = emailWrapper(`
    <p style="font-size:22px;font-weight:300;font-style:italic;line-height:1.5;margin-bottom:24px;">Hi ${firstName},</p>
    <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-bottom:16px;">Last one from me, I promise.</p>
    <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-bottom:16px;">We've crossed paths a few times over the past few weeks and I get it, timing is everything. So here's what I want to do: your first month is on me.</p>
    <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-bottom:32px;">No catch. Start free, see what the community is actually like, and decide from there. Use code <strong>${STRIPE_TRIAL_COUPON}</strong> at checkout.</p>
    <p style="font-size:13px;font-weight:300;letter-spacing:0.08em;text-transform:uppercase;color:#9a8f87;margin-bottom:24px;">This offer expires ${expiryString} at 11:59pm.</p>
    <div style="text-align:center;margin-bottom:16px;">
      <a href="${monthlyLink}" style="display:inline-block;background:#3d2b20;color:#F7F5F0;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;padding:14px 32px;text-decoration:none;margin-bottom:12px;">Become a Member</a>
    </div>
    <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-top:32px;">Whatever you decide, I'm rooting for you.</p>
    <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-top:8px;">Dani</p>
  `)

  return { subject, body }
}

function referralInviteEmail_(firstName, email, referrerFirstName, referrerLastName) {
  const subject     = `${referrerFirstName} ${referrerLastName} thinks you belong here`
  const monthlyLink = STRIPE_MONTHLY_LINK + "?prefilled_email=" + encodeURIComponent(email)

  const body = emailWrapper(`
    <p style="font-size:22px;font-weight:300;font-style:italic;line-height:1.5;margin-bottom:24px;">Hi ${firstName},</p>
    <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-bottom:16px;">${referrerFirstName} ${referrerLastName} thought you'd be a perfect fit for Elite Spaces and we tend to trust their judgment.</p>
    <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-bottom:16px;">Elite Spaces is a curated membership for those who want to be in the rooms where things actually happen. Every month we surface the best events in NYC — galas, pop-ups, art openings, industry nights — so your social calendar matches your ambition.</p>
    <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-bottom:32px;">Because ${referrerFirstName} referred you, your first month is on us. Use code <strong>${STRIPE_TRIAL_COUPON}</strong> at checkout.</p>
    <div style="text-align:center;margin-bottom:32px;">
      <a href="${monthlyLink}" style="display:inline-block;background:#3d2b20;color:#F7F5F0;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;padding:14px 32px;text-decoration:none;">Become a Member</a>
    </div>
    <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-top:32px;">Dani</p>
  `)

  return { subject, body }
}

// ── 8. DRIP SEQUENCE ──────────────────────────────────────────────────────────

function getTopEvents_() {
  // Only recent or upcoming events: the email says "this month", so old May events must not show up in November.
  // (The old version also crashed on range dates like "June 27-28, 2026" because new Date() can't read them.)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const windowStart = new Date(today.getTime() - 30 * 86400000)
  const events = []

  getEventsSheetRows_().forEach(row => {
    if ((row["Status"] || "").toString().trim() !== "Published") return
    const name = (row["Event Name"] || "").toString().trim()
    if (!name) return

    const vibeScore = vibeScoreNumber_(row["Vibe Score"])
    if (vibeScore < 9) return

    const range = parseEventDateRange_(row["Date"])
    if (!range.isExactDay || range.endDate < windowStart) return

    events.push({
      name,
      date:        (row["Date"] || "").toString(),
      location:    (row["Location"] || "").toString(),
      description: (row["Description"] || "").toString(),
      vibeScore,
      upcoming:    range.endDate >= today
    })
  })

  events.sort((a, b) => (b.upcoming - a.upcoming) || (b.vibeScore - a.vibeScore))
  return events.slice(0, 3)
}

function runApprovedNotPaidDrip() {
  const sheet = getSheet()
  const data  = sheet.getDataRange().getValues()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = 1; i < data.length; i++) {
    const row = data[i]

    const email          = row[COL.email - 1]
    const firstName      = row[COL.firstName - 1]
    const appStatus      = row[COL.applicationStatus - 1]
    const memberStatus   = row[COL.memberStatus - 1]
    const approvedAt     = row[COL.approvedAt - 1]
    const dripStage      = row[COL.dripStage - 1]
    const referredBy     = row[COL.referredBy - 1]
    const referralStatus = row[COL.referralStatus - 1]

    if (appStatus !== "approved")           continue
    if (memberStatus !== "payment_pending") continue
    if (!approvedAt)                        continue
    if (dripStage === "expired")            continue

    const approvedDate = new Date(approvedAt)
    approvedDate.setHours(0, 0, 0, 0)
    const daysSince = Math.floor((today - approvedDate) / (1000 * 60 * 60 * 24))

    if (daysSince >= DRIP_DAYS.expire) {
      sheet.getRange(i + 1, COL.dripStage).setValue("expired")
      continue
    }

    if (
      daysSince >= DRIP_DAYS.offer &&
      dripStage !== "offer_21d" &&
      dripStage !== "referral_14d" &&
      !referredBy &&
      !referralStatus
    ) {
      const template = dripOfferEmail_(firstName, email)
      GmailApp.sendEmail(email, template.subject, "", { htmlBody: template.body, from: FROM_EMAIL, name: FROM_NAME })
      sheet.getRange(i + 1, COL.dripStage).setValue("offer_21d")
      continue
    }

    if (
      daysSince >= DRIP_DAYS.referral &&
      dripStage !== "referral_14d" &&
      dripStage !== "offer_21d"
    ) {
      const template = dripReferralEmail_(firstName, email)
      GmailApp.sendEmail(email, template.subject, "", { htmlBody: template.body, from: FROM_EMAIL, name: FROM_NAME })
      sheet.getRange(i + 1, COL.dripStage).setValue("referral_14d")
      continue
    }

    if (
      daysSince >= DRIP_DAYS.feedback &&
      dripStage !== "feedback_10d" &&
      dripStage !== "referral_14d" &&
      dripStage !== "offer_21d"
    ) {
      const template = dripFeedbackEmail_(firstName, email)
      GmailApp.sendEmail(email, template.subject, "", { htmlBody: template.body, from: FROM_EMAIL, name: FROM_NAME })
      sheet.getRange(i + 1, COL.dripStage).setValue("feedback_10d")
      continue
    }

    if (
      daysSince >= DRIP_DAYS.events &&
      dripStage !== "events_5d" &&
      dripStage !== "feedback_10d" &&
      dripStage !== "referral_14d" &&
      dripStage !== "offer_21d"
    ) {
      const events = getTopEvents_()
      if (events.length > 0) {
        const template = dripEventsEmail_(firstName, email, events)
        GmailApp.sendEmail(email, template.subject, "", { htmlBody: template.body, from: FROM_EMAIL, name: FROM_NAME })
        sheet.getRange(i + 1, COL.dripStage).setValue("events_5d")
      }
      continue
    }

    if (daysSince >= DRIP_DAYS.reminder && !dripStage) {
      const template = dripReminderEmail_(firstName, email)
      GmailApp.sendEmail(email, template.subject, "", { htmlBody: template.body, from: FROM_EMAIL, name: FROM_NAME })
      sheet.getRange(i + 1, COL.dripStage).setValue("reminder_2d")
      continue
    }
  }
}

function runApprovedNotPaidDripTEST() {
  const sheet = getSheet()
  const data  = sheet.getDataRange().getValues()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = 1; i < data.length; i++) {
    const row      = data[i]
    const lastName = row[COL.lastName - 1]

    if (lastName !== "Test") continue

    const email          = row[COL.email - 1]
    const firstName      = row[COL.firstName - 1]
    const appStatus      = row[COL.applicationStatus - 1]
    const memberStatus   = row[COL.memberStatus - 1]
    const approvedAt     = row[COL.approvedAt - 1]
    const dripStage      = row[COL.dripStage - 1]
    const referredBy     = row[COL.referredBy - 1]
    const referralStatus = row[COL.referralStatus - 1]

    if (appStatus !== "approved")           continue
    if (memberStatus !== "payment_pending") continue
    if (!approvedAt)                        continue
    if (dripStage === "expired")            continue

    const approvedDate = new Date(approvedAt)
    approvedDate.setHours(0, 0, 0, 0)
    const daysSince = Math.floor((today - approvedDate) / (1000 * 60 * 60 * 24))

    Logger.log(`Testing row ${i + 1}: ${email}, days since approval: ${daysSince}, drip stage: ${dripStage}`)

    if (daysSince >= DRIP_DAYS.expire) {
      sheet.getRange(i + 1, COL.dripStage).setValue("expired")
      Logger.log("Marked expired")
      continue
    }

    if (
      daysSince >= DRIP_DAYS.offer &&
      dripStage !== "offer_21d" &&
      dripStage !== "referral_14d" &&
      !referredBy &&
      !referralStatus
    ) {
      const template = dripOfferEmail_(firstName, email)
      GmailApp.sendEmail(email, template.subject, "", { htmlBody: template.body, from: FROM_EMAIL, name: FROM_NAME })
      sheet.getRange(i + 1, COL.dripStage).setValue("offer_21d")
      Logger.log("Sent: offer_21d")
      continue
    }

    if (
      daysSince >= DRIP_DAYS.referral &&
      dripStage !== "referral_14d" &&
      dripStage !== "offer_21d"
    ) {
      const template = dripReferralEmail_(firstName, email)
      GmailApp.sendEmail(email, template.subject, "", { htmlBody: template.body, from: FROM_EMAIL, name: FROM_NAME })
      sheet.getRange(i + 1, COL.dripStage).setValue("referral_14d")
      Logger.log("Sent: referral_14d")
      continue
    }

    if (
      daysSince >= DRIP_DAYS.feedback &&
      dripStage !== "feedback_10d" &&
      dripStage !== "referral_14d" &&
      dripStage !== "offer_21d"
    ) {
      const template = dripFeedbackEmail_(firstName, email)
      GmailApp.sendEmail(email, template.subject, "", { htmlBody: template.body, from: FROM_EMAIL, name: FROM_NAME })
      sheet.getRange(i + 1, COL.dripStage).setValue("feedback_10d")
      Logger.log("Sent: feedback_10d")
      continue
    }

    if (
      daysSince >= DRIP_DAYS.events &&
      dripStage !== "events_5d" &&
      dripStage !== "feedback_10d" &&
      dripStage !== "referral_14d" &&
      dripStage !== "offer_21d"
    ) {
      const events = getTopEvents_()
      if (events.length > 0) {
        const template = dripEventsEmail_(firstName, email, events)
        GmailApp.sendEmail(email, template.subject, "", { htmlBody: template.body, from: FROM_EMAIL, name: FROM_NAME })
        sheet.getRange(i + 1, COL.dripStage).setValue("events_5d")
        Logger.log("Sent: events_5d")
      } else {
        Logger.log("No published events with vibe score 9+ found — events email skipped")
      }
      continue
    }

    if (daysSince >= DRIP_DAYS.reminder && !dripStage) {
      const template = dripReminderEmail_(firstName, email)
      GmailApp.sendEmail(email, template.subject, "", { htmlBody: template.body, from: FROM_EMAIL, name: FROM_NAME })
      sheet.getRange(i + 1, COL.dripStage).setValue("reminder_2d")
      Logger.log("Sent: reminder_2d")
      continue
    }
  }
}

// ── 9. EVENTS — DATES, TEXT & MATCHING ───────────────────────────────────────

const EVENT_COLS = {
  name: 1, date: 2, time: 3, location: 4, description: 5, url: 6,
  vibe: 7, status: 8, notes: 9, categories: 10, isFree: 11
}
const EVENT_HEADERS = ["Event Name", "Date", "Time", "Location", "Description", "Source URL", "Vibe Score", "Status", "Notes", "Categories", "isFree"]

// The site's category filters (same set inferCategories_ produces). Anything else is mapped onto these or dropped.
const ALLOWED_CATEGORIES = ["gala", "beauty", "popup", "art", "industry", "free"]
const CATEGORY_ALIASES = {
  "pop-up": "popup", "pop-ups": "popup", "popups": "popup", "pop up": "popup", "activation": "popup",
  "launch": "popup", "retail": "popup", "shop": "popup", "market": "popup", "sample sale": "popup",
  "benefit": "gala", "charity": "gala", "fundraiser": "gala", "dinner": "gala", "society": "gala",
  "skincare": "beauty", "makeup": "beauty", "fragrance": "beauty", "k-beauty": "beauty",
  "gallery": "art", "museum": "art", "exhibition": "art", "art fair": "art", "fair": "art", "arts": "art",
  "theater": "art", "theatre": "art", "broadway": "art", "ballet": "art", "dance": "art", "performance": "art",
  "music": "art", "film": "art", "culture": "art", "photography": "art",
  "trade show": "industry", "b2b": "industry", "summit": "industry", "conference": "industry", "networking": "industry"
}

const MONTH_NAMES_ = ["January","February","March","April","May","June","July","August","September","October","November","December"]
const MONTH_INDEX_ = {}
MONTH_NAMES_.forEach((m, i) => { MONTH_INDEX_[m.toLowerCase()] = i; MONTH_INDEX_[m.slice(0, 3).toLowerCase()] = i })
MONTH_INDEX_["sept"] = 8

const VAGUE_VENUES_ = new Set([
  "", "nyc", "ny", "new york", "new york ny", "new york city", "manhattan", "brooklyn", "queens", "the bronx",
  "bronx", "staten island", "hamptons", "the hamptons", "citywide", "soho", "tribeca", "chelsea", "midtown",
  "lower east side", "upper east side", "upper west side", "meatpacking district", "williamsburg", "online"
])

function cleanDashes_(s) {
  return (s || "").toString().replace(/[‒–—―]/g, "-").replace(/\s*--\s*/g, " - ")
}

function collapse_(s) {
  return (s || "").toString().replace(/[\t\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim()
}

function startOfDay_(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

// Returns { startDate, endDate, isExactDay, approxStart, approxEnd }.
// startDate/endDate are only set when an exact day is known. approxStart/approxEnd also cover
// month-only dates ("September 2026"), which the duplicate check and past-event check use.
function parseEventDateRange_(value) {
  const none = { startDate: null, endDate: null, isExactDay: false, approxStart: null, approxEnd: null }
  if (value === null || value === undefined || value === "") return none
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return none
    const d = startOfDay_(value)
    return { startDate: d, endDate: d, isExactDay: true, approxStart: d, approxEnd: d }
  }

  const s = cleanDashes_(value.toString())
    .replace(/\s+(to|through|thru|until)\s+/gi, " - ")
    .replace(/(\d{1,2})(st|nd|rd|th)\b/gi, "$1")

  const yearMatch    = s.match(/\b(20\d{2})\b/)
  const fallbackYear = yearMatch ? parseInt(yearMatch[1], 10) : null

  // "Month D", "Month D-D", each with an optional year: "June 27-28, 2026", "Sep 9 - Oct 17, 2026"
  const re = /\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?![\d:])(?:\s*-\s*(\d{1,2})(?![\d:]))?(?:,?\s*(20\d{2}))?/g
  const points = []
  let m
  while ((m = re.exec(s)) !== null) {
    const mon = MONTH_INDEX_[m[1].toLowerCase()]
    if (mon === undefined) continue
    points.push({ mon, d1: +m[2], d2: m[3] ? +m[3] : null, year: m[4] ? +m[4] : fallbackYear, ownYear: !!m[4] })
  }

  if (points.length === 0) {
    const mm = s.match(/\b([A-Za-z]{3,9})\.?,?\s+(20\d{2})\b/)
    if (mm && MONTH_INDEX_[mm[1].toLowerCase()] !== undefined) {
      const mon = MONTH_INDEX_[mm[1].toLowerCase()], yr = +mm[2]
      return Object.assign({}, none, { approxStart: new Date(yr, mon, 1), approxEnd: new Date(yr, mon + 1, 0) })
    }
    return none
  }

  const today = startOfDay_(new Date())
  const toDate = (p, day) => {
    let yr = p.year
    if (!yr) {
      yr = today.getFullYear()
      if (new Date(yr, p.mon, day) < new Date(today.getTime() - 60 * 86400000)) yr++
    }
    const d = new Date(yr, p.mon, day)
    return d.getMonth() === p.mon ? d : null   // rejects impossible days like "June 31"
  }

  const first = points[0]
  const last  = points[points.length - 1]
  const start = toDate(first, first.d1)
  let end     = toDate(last, last.d2 || last.d1)
  if (!start) return none

  if (end && end < start) {
    if (!first.ownYear) start.setFullYear(start.getFullYear() - 1)   // "June 5 - January 10, 2027"
    else if (!last.ownYear) end.setFullYear(end.getFullYear() + 1)   // "December 30, 2026 - January 2"
  }
  if (!end || end < start) end = start

  return { startDate: start, endDate: end, isExactDay: true, approxStart: start, approxEnd: end }
}

function formatDateRange_(start, end) {
  const M = d => MONTH_NAMES_[d.getMonth()]
  if (!end || start.getTime() === end.getTime()) return `${M(start)} ${start.getDate()}, ${start.getFullYear()}`
  if (start.getFullYear() !== end.getFullYear()) {
    return `${M(start)} ${start.getDate()}, ${start.getFullYear()} - ${M(end)} ${end.getDate()}, ${end.getFullYear()}`
  }
  if (start.getMonth() === end.getMonth()) return `${M(start)} ${start.getDate()}-${end.getDate()}, ${start.getFullYear()}`
  return `${M(start)} ${start.getDate()} - ${M(end)} ${end.getDate()}, ${start.getFullYear()}`
}

// Rewrites a date into one format ("October 28, 2026", "June 27-28, 2026", "September 16 - October 18, 2026").
// Text that carries more than a plain date ("Every other Tuesday from May 12", "May 14, 21, 28 + June 4") is kept as written.
function normalizeDateText_(raw) {
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return ""
    const d = startOfDay_(raw)
    return formatDateRange_(d, d)
  }
  const s = collapse_(cleanDashes_(raw))
  if (!s) return ""
  const r = parseEventDateRange_(s)
  if (!r.isExactDay) return s

  const leftover = s
    .replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b\.?/gi, "")
    .replace(/\b(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b\.?/gi, "")
    .replace(/\b20\d{2}\b/g, "")
    .replace(/\b\d{1,2}(st|nd|rd|th)?\b/gi, "")
    .replace(/(\d|\s)(to|through|thru|until)\s/gi, "$1 ")   // only between two dates; a leading "Through ..." is kept as written
    .replace(/[\s,\-]/g, "")
  if (leftover) return s

  const dayNumbers = (s.replace(/\b20\d{2}\b/g, "").match(/\b\d{1,2}\b/g) || []).length
  if (dayNumbers > 2) return s

  return formatDateRange_(r.startDate, r.endDate)
}

// "7pm" -> "7:00 PM", "12PM-6PM" -> "12:00 PM - 6:00 PM". With strict=true, anything without a clock time becomes "TBD".
function normalizeTimeText_(raw, tz, strict) {
  if (raw instanceof Date) return isNaN(raw.getTime()) ? "" : Utilities.formatDate(raw, tz, "h:mm a")
  let s = collapse_(cleanDashes_(raw))
  if (!s) return strict ? "TBD" : ""
  s = s.replace(/\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s?m\b\.?/gi, (_, h, mm, ap) => `${+h}:${mm || "00"} ${ap.toUpperCase()}M`)
  s = s.replace(/\s*-\s*(?=\d{1,2}(:\d{2})?\s*[AP]M\b|\d{1,2}:\d{2})/g, " - ")   // only dashes before a time, so "Single-day" stays intact
  if (strict && isVagueTime_(s)) return "TBD"
  return s
}

function isVagueTime_(s) {
  return !/\b\d{1,2}(:\d{2})?\s*[AP]M\b|\b\d{1,2}:\d{2}\b/i.test((s || "").toString())
}

function normalizeText_(str) {
  return (str || "").toString()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim()
}

function firstVenueSegment_(venue) {
  return normalizeText_((venue || "").toString().split(/[,(]/)[0])
}

function isVagueLocation_(s) {
  const v = normalizeText_(s)
  if (!v) return true
  if (/\b(tbd|tba|tbc|unspecified|not specified|undisclosed|various|multiple)\b/.test(v)) return true
  return VAGUE_VENUES_.has(firstVenueSegment_(s))
}

function tokenize_(str) {
  const stopwords = new Set(["the","a","an","at","in","on","of","and","x","nyc","ny","pop","up","popup","presents","event",
    "experience","exhibition","gallery","opening","new","york","festival","week","2025","2026","2027","2028","annual",
    "weekend","series","celebration","show","with","for","to","by","its","s","edition","city"])
  return normalizeText_(str).split(" ").filter(w => w && !stopwords.has(w))
}

function jaccardSimilarity_(tokensA, tokensB) {
  const a = new Set(tokensA), b = new Set(tokensB)
  const intersection = [...a].filter(x => b.has(x)).length
  const union = new Set([...a, ...b]).size
  return union === 0 ? 0 : intersection / union
}

function vibeScoreNumber_(v) {
  const m = (v || "").toString().match(/\d+/)
  return m ? parseInt(m[0], 10) : 0
}

function normalizeVibeText_(v) {
  const s = collapse_(cleanDashes_(v))
  const m = s.match(/^(\d{1,2})\s*(?:\/\s*10)?\s*[-:]*\s*(.*)$/)
  if (!m) return s
  return m[2] ? `${m[1]} - ${m[2]}` : m[1]
}

function normalizeCategory_(cat) {
  const c = (cat || "").toString().trim().toLowerCase()
  return CATEGORY_ALIASES[c] || c
}

function cleanCategories_(raw, name, description, isFree) {
  const out = []
  ;(raw || "").toString().split(",").forEach(c => {
    const n = normalizeCategory_(c)
    if (ALLOWED_CATEGORIES.includes(n) && !out.includes(n)) out.push(n)
  })
  if (!out.filter(c => c !== "free").length) {
    inferCategories_(name || "", description || "").categories.split(",").forEach(c => {
      if (c && !out.includes(c)) out.push(c)
    })
  }
  if (isFree && !out.includes("free")) out.push("free")
  if (!isFree) {
    const i = out.indexOf("free")
    if (i > -1 && out.length > 1) out.splice(i, 1)
  }
  return out.join(",")
}

function toBool_(v) {
  if (v === true || v === false) return v
  return /^(true|yes|1)$/i.test((v || "").toString().trim())
}

function inferCategories_(name, description) {
  const text = (name + " " + description).toLowerCase()
  const cats = []
  if (/gala|benefit|dinner|fundraiser|black.tie/.test(text))                                                                             cats.push("gala")
  if (/beauty|skincare|fragrance|makeup|cosmetic|sephora|ulta|lanc[oô]me|fenty|k-beauty|pop-up.*beauty|beauty.*pop-up/.test(text))      cats.push("beauty")
  if (/pop.?up|activation|launch|opening|showroom|store/.test(text))                                                                    cats.push("popup")
  if (/art|museum|gallery|exhibition|moma|met |guggenheim|frieze|performance|theater|theatre|ballet|opera|concert/.test(text))          cats.push("art")
  if (/industry|trade show|b2b|supplier|professional|summit/.test(text))                                                                cats.push("industry")
  const isFree = /\bfree\b|no cost|complimentary|open to (all|public)/.test(text)
  if (isFree) cats.push("free")
  return {
    categories: cats.join(",") || "art",
    isFree:     isFree
  }
}

// ── Duplicate matching ──

function eventMatchInfo_(ev) {
  return {
    tokens: tokenize_(ev["Event Name"]),
    venue:  isVagueLocation_(ev["Location"]) ? "" : firstVenueSegment_(ev["Location"]),
    range:  parseEventDateRange_(ev["Date"])
  }
}

// 0 = different events. Otherwise the name similarity of a likely duplicate.
function matchScore_(a, b) {
  const nameSim = jaccardSimilarity_(a.tokens, b.tokens)
  if (nameSim < 0.1) return 0
  const setA = new Set(a.tokens), setB = new Set(b.tokens)
  const shared = [...setA].filter(t => setB.has(t)).length
  const sameWords = shared === setA.size && shared === setB.size

  const venueMatch = !!(a.venue && b.venue &&
    (a.venue === b.venue || a.venue.includes(b.venue) || b.venue.includes(a.venue)))

  let overlap = false, farApart = false, sameDay = false
  const aS = a.range.approxStart, aE = a.range.approxEnd, bS = b.range.approxStart, bE = b.range.approxEnd
  if (aS && bS) {
    overlap = aS <= bE && aE >= bS
    if (!overlap) {
      const gapDays = Math.min(Math.abs(aS - bE), Math.abs(bS - aE)) / 86400000
      farApart = gapDays > 45       // same name, different edition (e.g. next year's gala)
    }
    sameDay = a.range.isExactDay && b.range.isExactDay && a.range.startDate.getTime() === b.range.startDate.getTime()
  }

  if (farApart) return 0
  if (nameSim >= 0.5 && (shared >= 2 || sameWords)) return nameSim   // one shared word ("Tribeca") isn't enough on its own
  if (nameSim >= 0.35 && (venueMatch || overlap)) return nameSim
  if (sameDay && venueMatch) return nameSim   // same venue, same night, differently worded name
  return 0
}

function findExistingEventMatch_(ev, pool) {
  const info = eventMatchInfo_(ev)
  let best = null, bestScore = 0
  pool.forEach(row => {
    const score = matchScore_(info, row._match || (row._match = eventMatchInfo_(row)))
    if (score > bestScore) { bestScore = score; best = row }
  })
  return best
}

function getEventsSheet_() {
  return SpreadsheetApp.openById(EVENTS_SHEET_ID).getSheetByName("Events")
}

// Every row of the Events sheet as an object. Date and Time cells that Sheets auto-converted
// into date/time values are turned back into text here, so nothing downstream sees "Sat Dec 30 1899".
function getEventsSheetRows_() {
  try {
    const sheet = getEventsSheet_()
    const tz    = sheet.getParent().getSpreadsheetTimeZone()
    const data  = sheet.getDataRange().getValues()
    if (data.length < 2) return []
    const headers = data[0].map(h => h.toString().trim())
    const rows = []
    data.slice(1).forEach((row, i) => {
      if (!row.some(c => c !== "" && c !== null)) return
      const obj = {}
      headers.forEach((h, j) => { obj[h] = row[j] })
      if (obj["Date"] instanceof Date) obj["Date"] = normalizeDateText_(obj["Date"])
      if (obj["Time"] instanceof Date) obj["Time"] = normalizeTimeText_(obj["Time"], tz, false)
      obj._rowIndex = i + 2
      rows.push(obj)
    })
    return rows
  } catch (err) {
    Logger.log("getEventsSheetRows_ error: " + err.message)
    return []
  }
}

// Rows that haven't ended yet (or have no usable date). Used for the "already have these" list in the prompt.
function getUpcomingEventRows_() {
  const today = startOfDay_(new Date())
  return getEventsSheetRows_().filter(row => {
    const r = parseEventDateRange_(row["Date"])
    return !r.approxEnd || r.approxEnd >= today
  })
}

function findDuplicateGroups_() {
  const rows = getEventsSheetRows_()
  rows.forEach(r => { r._match = eventMatchInfo_(r) })
  const used = new Set()
  const groups = []

  rows.forEach((row, i) => {
    if (used.has(i)) return
    const group = [row]
    used.add(i)
    rows.forEach((other, j) => {
      if (used.has(j)) return
      if (group.some(g => matchScore_(g._match, other._match) > 0)) {
        group.push(other)
        used.add(j)
      }
    })
    if (group.length > 1) groups.push(group)
  })

  return groups
}

function statusPriority_(status) {
  const s = (status || "").toString().trim().toLowerCase()
  if (s === "published")      return 4
  if (s === "approved")       return 3
  if (s === "pending review") return 2
  if (s === "rejected")       return 0
  return 1
}

function completeness_(row) {
  return (parseEventDateRange_(row["Date"]).isExactDay ? 1 : 0) +
         (isVagueTime_(row["Time"]) ? 0 : 1) +
         (isVagueLocation_(row["Location"]) ? 0 : 1)
}

function reportDuplicates() {
  const groups = findDuplicateGroups_()

  if (groups.length === 0) {
    Logger.log("No duplicate groups found.")
    GmailApp.sendEmail(ADMIN_EMAIL, "Elite Spaces — Duplicate Scan: none found",
      "No duplicate event groups were found in the Events sheet.")
    return
  }

  let body = `Found ${groups.length} duplicate group(s) in the Events sheet:\n\n`
  groups.forEach((group, i) => {
    body += `Group ${i + 1}:\n`
    group.forEach(row => {
      body += `  - Row ${row._rowIndex}: "${row["Event Name"]}" | Status: ${row["Status"]} | Date: ${row["Date"]} | Time: ${row["Time"]} | Location: ${row["Location"]}\n`
    })
    body += "\n"
  })
  body += "This is a DRY RUN. Nothing has been changed. If the groups look right, run mergeDuplicates. " +
          "Each group keeps its best row (Published > Approved > Pending Review > blank > Rejected, then the most complete, then the oldest), " +
          "copies over any exact date, time or venue the other rows had, and deletes the rest."

  Logger.log(body)
  GmailApp.sendEmail(ADMIN_EMAIL, `Elite Spaces — Duplicate Scan: ${groups.length} group(s) found`, body)
}

function mergeDuplicates() {
  const groups = findDuplicateGroups_()
  if (groups.length === 0) {
    Logger.log("No duplicate groups found — nothing to merge.")
    return
  }

  const sheet = getEventsSheet_()
  const rowsToDelete = []
  let summary = `Merged ${groups.length} duplicate group(s):\n\n`

  groups.forEach(group => {
    const sorted = group.slice().sort((a, b) =>
      (statusPriority_(b["Status"]) - statusPriority_(a["Status"])) ||
      (completeness_(b) - completeness_(a)) ||
      (a._rowIndex - b._rowIndex)   // otherwise keep the original (earliest) row
    )

    const keep   = sorted[0]
    const remove = sorted.slice(1)

    // Pull the best details from the rows being removed into the row being kept
    remove.forEach(r => fillGapsInRow_(sheet, keep, r))

    summary += `KEEP Row ${keep._rowIndex}: "${keep["Event Name"]}" (${keep["Status"]})\n`
    remove.forEach(r => {
      summary += `  DELETE Row ${r._rowIndex}: "${r["Event Name"]}" (${r["Status"]})\n`
      rowsToDelete.push(r._rowIndex)
    })
    summary += "\n"
  })

  rowsToDelete.sort((a, b) => b - a).forEach(rowIdx => sheet.deleteRow(rowIdx))

  Logger.log(summary)
  GmailApp.sendEmail(ADMIN_EMAIL, `Elite Spaces — Duplicate Cleanup: ${rowsToDelete.length} row(s) removed`, summary)
}

// Copies details from `ev` into an existing sheet row, but only where the row is missing them
// or has a vague value ("TBD", "Hours vary", "NYC", "September 2026"). Never overwrites a real
// value with a worse one and never touches Status. Returns a list of what changed.
function fillGapsInRow_(sheet, row, ev) {
  const changes = []
  const setText = (col, header, value) => {
    const cell = sheet.getRange(row._rowIndex, col)
    cell.setNumberFormat("@")
    cell.setValue(value)
    changes.push(`${header}: "${row[header] || ""}" -> "${value}"`)
    row[header] = value
    row._match = null
  }

  const newDate = normalizeDateText_(ev["Date"])
  if (newDate && parseEventDateRange_(newDate).isExactDay && !parseEventDateRange_(row["Date"]).isExactDay) {
    setText(EVENT_COLS.date, "Date", newDate)
  }

  const newTime = (ev["Time"] || "").toString().trim()
  if (newTime && !isVagueTime_(newTime) && isVagueTime_(row["Time"])) {
    setText(EVENT_COLS.time, "Time", newTime)
  }

  const newLoc = (ev["Location"] || "").toString().trim()
  if (newLoc && !isVagueLocation_(newLoc) && isVagueLocation_(row["Location"])) {
    setText(EVENT_COLS.location, "Location", newLoc)
  }

  if (!(row["Description"] || "").toString().trim() && ev["Description"]) setText(EVENT_COLS.description, "Description", ev["Description"])
  if (!(row["Source URL"]  || "").toString().trim() && ev["Source URL"])  setText(EVENT_COLS.url, "Source URL", ev["Source URL"])

  return changes
}

// ── 10. EVENTS — REQUEST HANDLERS ────────────────────────────────────────────

function handleGetEvents(_data) {
  const rows         = getEventsSheetRows_()
  const now          = new Date()
  const currentMonth = now.getMonth()
  const currentYear  = now.getFullYear()
  const monthStart   = new Date(currentYear, currentMonth, 1)
  const monthEnd     = new Date(currentYear, currentMonth + 1, 0)
  const days         = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const events       = []
  let id = 1

  rows.forEach(row => {
    const status = (row["Status"] || "").toString().trim()
    if (status !== "Published" && status !== "Approved") return

    const { startDate, endDate } = parseEventDateRange_(row["Date"])
    if (!startDate || !endDate) return

    // Show the event if its date range overlaps the current month at all
    if (startDate > monthEnd || endDate < monthStart) return

    // Display date: actual start day if it falls in this month, otherwise day 1 (event is already ongoing)
    const displayDate = startDate < monthStart ? monthStart : startDate

    const isFree = toBool_(row["isFree"])
    let cats = (row["Categories"] || "").toString().split(",").map(c => normalizeCategory_(c)).filter(Boolean)
    if (isFree && !cats.includes("free")) cats.push("free")

    events.push({
      id:          id++,
      date:        displayDate.getDate(),
      day:         days[displayDate.getDay()],
      name:        (row["Event Name"]  || "").toString(),
      venue:       (row["Location"]    || "").toString(),
      time:        (row["Time"]        || "").toString(),
      description: (row["Description"] || "").toString(),
      categories:  cats,
      isFree:      isFree,
      vibeScore:   vibeScoreNumber_(row["Vibe Score"])
    })
  })

  events.sort((a, b) => (a.date || 0) - (b.date || 0))

  return jsonResponse({ events: events, month: currentMonth + 1, year: currentYear })
}

function handleUpdateEvents(data) {
  const incoming = data.events || []
  if (!incoming.length) return jsonResponse({ result: "no_events" })
  const report = upsertEvents_(incoming)
  return jsonResponse({ result: "success", added: report.added.length, updated: report.updated.length })
}

// Cleans an event from Claude (or the site) into the sheet's formats.
function cleanIncomingEvent_(raw) {
  const name        = collapse_(raw["Event Name"])
  const description = collapse_(raw["Description"])
  const isFree      = raw["isFree"] !== undefined && raw["isFree"] !== "" ? toBool_(raw["isFree"]) : inferCategories_(name, description).isFree
  return {
    "Event Name":  name,
    "Date":        normalizeDateText_(raw["Date"]),
    "Time":        normalizeTimeText_(raw["Time"], Session.getScriptTimeZone(), true),
    "Location":    collapse_(cleanDashes_(raw["Location"])),
    "Description": description,
    "Source URL":  collapse_(raw["Source URL"]),
    "Vibe Score":  normalizeVibeText_(raw["Vibe Score"]),
    "Notes":       collapse_(cleanDashes_(raw["Notes"])),
    "Categories":  cleanCategories_(raw["Categories"], name, description, isFree),
    "isFree":      isFree
  }
}

// Adds new events and fills gaps in existing ones. Matches against EVERY row in the sheet
// (the old version only checked this month and next, so anything further out was re-added each run).
function upsertEvents_(incomingEvents) {
  const sheet  = getEventsSheet_()
  const pool   = getEventsSheetRows_()
  const report = { added: [], updated: [], duplicates: [], needsDate: [] }

  incomingEvents.forEach(raw => {
    const ev = cleanIncomingEvent_(raw)
    if (!ev["Event Name"]) return

    const existing = findExistingEventMatch_(ev, pool)
    if (existing) {
      const changes = fillGapsInRow_(sheet, existing, ev)
      if (changes.length) report.updated.push({ name: existing["Event Name"], row: existing._rowIndex, changes })
      else report.duplicates.push(ev["Event Name"] + (normalizeText_(ev["Event Name"]) !== normalizeText_(existing["Event Name"]) ? `  (= "${existing["Event Name"]}")` : ""))
      return
    }

    if (PIPELINE_CONFIG.REQUIRE_EXACT_DATE && !parseEventDateRange_(ev["Date"]).isExactDay) {
      report.needsDate.push(ev)
      return
    }

    const rowIdx = sheet.getLastRow() + 1
    if (rowIdx > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 50)
    const values = [
      ev["Event Name"], ev["Date"], ev["Time"], ev["Location"], ev["Description"], ev["Source URL"],
      ev["Vibe Score"], "Pending Review", ev["Notes"], ev["Categories"], ev["isFree"]
    ]
    const range = sheet.getRange(rowIdx, 1, 1, values.length)
    range.setNumberFormats([values.map((_, j) => j === EVENT_COLS.isFree - 1 ? "General" : "@")])   // plain text: stops Sheets turning dates/times into date values
    range.setValues([values])

    const added = Object.assign({}, ev, { "Status": "Pending Review", _rowIndex: rowIdx })
    pool.push(added)       // so a second copy later in this same batch is caught
    report.added.push(added)
  })

  SpreadsheetApp.flush()
  Logger.log(`upsertEvents_: added=${report.added.length}, updated=${report.updated.length}, duplicates=${report.duplicates.length}, needsDate=${report.needsDate.length}`)
  return report
}

function handlePublishApproved(_data) {
  const sheet     = getEventsSheet_()
  const rows      = getEventsSheetRows_()
  const published = []

  rows.forEach(row => {
    if ((row["Status"] || "").toString().trim() === "Approved") {
      sheet.getRange(row._rowIndex, EVENT_COLS.status).setValue("Published")
      published.push(row["Event Name"] || "")
    }
  })

  SpreadsheetApp.flush()
  return jsonResponse({ result: "success", published: published, count: published.length })
}

// ── 11. EVENTS — PIPELINE ─────────────────────────────────────────────────────

function runEventsPipeline() {
  const runStart     = Date.now()
  const anthropicKey = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY")
  const braveKey     = PropertiesService.getScriptProperties().getProperty("BRAVE_API_KEY")

  // Stops two runs overlapping (e.g. a duplicate trigger) and writing the same events twice
  const lock = LockService.getScriptLock()
  if (!lock.tryLock(5000)) {
    Logger.log("Another pipeline run is in progress. Exiting.")
    return
  }

  try {
    const today        = new Date()
    const currentMonth = MONTH_NAMES_[today.getMonth()]
    const nextMonth    = MONTH_NAMES_[(today.getMonth() + 1) % 12]
    const currentYear  = today.getFullYear()
    const dateStr      = currentMonth + " " + today.getDate() + ", " + currentYear
    const stats        = { belowScore: 0, past: 0, filledIn: 0, claudeError: "" }

    Logger.log("Running searches...")
    const searchResults = runSearches_(braveKey, currentMonth, nextMonth, currentYear)

    Logger.log("Fetching event pages...")
    const pages = enrichTopResults_(searchResults)
    Logger.log("Fetched " + pages.length + " pages. Calling Claude...")

    const response = callClaude_(anthropicKey, buildPipelinePrompt_(searchResults, pages, dateStr), PIPELINE_CONFIG.CLAUDE_MAX_TOKENS)
    if (!response) stats.claudeError = "Claude returned nothing (see Apps Script logs for the API error)."
    const parsed = parseClaudeResponse_(response)
    let events = parsed.events || []

    const beforeScore = events.length
    events = events.filter(e => vibeScoreNumber_(e["Vibe Score"]) >= PIPELINE_CONFIG.MIN_SCORE_TO_INCLUDE)
    stats.belowScore = beforeScore - events.length

    // Second pass: re-read each incomplete event's own page for the missing day/time/venue
    if (Date.now() - runStart < PIPELINE_CONFIG.RUNTIME_BUDGET_MS) {
      stats.filledIn = fillMissingDetails_(anthropicKey, events, pages)
    } else {
      Logger.log("Skipping fill-in pass: runtime budget used up.")
    }

    if (PIPELINE_CONFIG.DROP_PAST_EVENTS) {
      const beforeDate = events.length
      events = events.filter(e => eventIsNotPast_(e, today))
      stats.past = beforeDate - events.length
    }

    const report = events.length ? upsertEvents_(events) : { added: [], updated: [], duplicates: [], needsDate: [] }

    if (PIPELINE_CONFIG.TIDY_SHEET_AFTER_RUN) tidyEventsSheet()

    sendPipelineReport_(report, parsed.updates || [], stats, dateStr)
  } finally {
    lock.releaseLock()
  }
}

function eventIsNotPast_(ev, today) {
  const range = parseEventDateRange_(ev["Date"])
  if (!range.approxEnd) return true
  return range.approxEnd >= startOfDay_(today)
}

function runSearches_(braveApiKey, currentMonth, nextMonth, currentYear) {
  const queries = [
    `averagesocialite.com new york city events ${currentMonth} ${currentYear}`,
    `nycforfree.co events ${currentMonth} ${currentYear}`,
    `invitednyc.com gala benefit ${currentMonth} ${currentYear}`,
    `luma.com nyc luxury event ${currentMonth} ${currentYear}`,
    `NYC luxury beauty pop-up ${currentMonth} ${currentYear}`,
    `NYC luxury beauty pop-up ${nextMonth} ${currentYear}`,
    `NYC gala benefit dinner ${currentMonth} ${currentYear}`,
    `NYC gala benefit dinner ${nextMonth} ${currentYear}`,
    `NYC art fair gallery opening ${currentMonth} ${currentYear}`,
    `NYC fashion pop-up activation ${currentMonth} ${currentYear}`,
    `Fenty Lancome YSL Chanel Dior beauty event NYC ${currentYear}`,
  ]

  const results = []

  queries.forEach((query, i) => {
    try {
      const url = "https://api.search.brave.com/res/v1/web/search"
        + "?q=" + encodeURIComponent(query)
        + "&count=" + PIPELINE_CONFIG.RESULTS_PER_QUERY
        + "&country=us&search_lang=en&result_filter=web"
        + "&extra_snippets=true"

      const response = UrlFetchApp.fetch(url, {
        method: "get",
        headers: {
          "Accept": "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": braveApiKey
        },
        muteHttpExceptions: true
      })

      if (response.getResponseCode() !== 200) {
        Logger.log("Brave error on query " + i + ": " + response.getContentText())
        results.push({ query: query, hits: [] })
        return
      }

      const data = JSON.parse(response.getContentText())
      const hits = ((data.web && data.web.results) || []).map(r => ({
        title:       r.title       || "",
        url:         r.url         || "",
        description: r.description || "",
        extra:       (r.extra_snippets || []).join(" | ")
      }))

      results.push({ query: query, hits: hits })
      Logger.log("Query " + (i + 1) + " returned " + hits.length + " results")

      Utilities.sleep(300)
    } catch (err) {
      Logger.log("Search error on query " + i + ": " + err.message)
      results.push({ query: query, hits: [] })
    }
  })

  return results
}

function enrichTopResults_(searchResults) {
  const seen = {}
  const candidates = []
  searchResults.forEach(s => {
    s.hits.forEach(h => {
      if (!h.url || seen[h.url]) return
      seen[h.url] = true
      candidates.push(h)
    })
  })

  candidates.sort((a, b) => scoreUrlForFetch_(b) - scoreUrlForFetch_(a))

  // Fetch a few extra in parallel since some pages will fail or block us
  const toFetch = candidates.slice(0, PIPELINE_CONFIG.MAX_PAGES_TO_FETCH + 8)
  const titles  = {}
  toFetch.forEach(h => { titles[h.url] = h.title })

  return fetchPagesParallel_(toFetch.map(h => h.url))
    .slice(0, PIPELINE_CONFIG.MAX_PAGES_TO_FETCH)
    .map(p => Object.assign(p, { title: titles[p.url] || "" }))
}

function scoreUrlForFetch_(hit) {
  const u = (hit.url || "").toLowerCase()
  let score = 0

  const path = u.replace(/^https?:\/\/[^/]+/, "")
  const pathDepth = (path.match(/\//g) || []).length
  score += Math.min(pathDepth, 4) * 2

  if (u.indexOf("averagesocialite.com/nyc-events/") > -1) score += 8
  if (u.indexOf("eventbrite.com/e/") > -1)                score += 7
  if (u.indexOf("luma.com") > -1 || u.indexOf("lu.ma") > -1) score += 6
  if (u.indexOf("nycforfree.co/events/") > -1)            score += 6
  if (/\.org\//.test(u) && /(gala|benefit|museum|foundation|donate)/.test(u)) score += 5

  if (!/averagesocialite|nycforfree|invitednyc|allevents|myguide|secretnyc|hypebeast|hellomagazine|donyc/.test(u)) score += 3

  if (/\/(events|calendar|fashion-beauty|film-tv|free)\/?($|\?)/.test(u)) score -= 4

  return score
}

// Fetches pages 8 at a time in parallel (the old version fetched one by one and ran out of time after ~14).
function fetchPagesParallel_(urls) {
  const out = []
  const params = {
    method: "get",
    followRedirects: true,
    muteHttpExceptions: true,
    headers: { "User-Agent": PIPELINE_CONFIG.USER_AGENT, "Accept": "text/html" }
  }

  for (let i = 0; i < urls.length; i += 8) {
    const batch = urls.slice(i, i + 8)
    let responses
    try {
      responses = UrlFetchApp.fetchAll(batch.map(u => Object.assign({ url: u }, params)))
    } catch (err) {
      Logger.log("Batch fetch failed (" + err.message + "), retrying one at a time")
      responses = batch.map(u => { try { return UrlFetchApp.fetch(u, params) } catch (e) { return null } })
    }
    responses.forEach((res, j) => {
      try {
        if (!res || res.getResponseCode() !== 200) return
        const page = extractPage_(res.getContentText())
        if (page && (page.text || page.jsonld)) out.push(Object.assign({ url: batch[j] }, page))
      } catch (e) {
        Logger.log("Could not read " + batch[j] + ": " + e.message)
      }
    })
  }
  return out
}

function extractPage_(html) {
  if (!html) return null

  // schema.org JSON-LD: the most reliable source of startDate/endDate/venue
  let jsonld = ""
  const ldMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
  ldMatches.forEach(block => {
    const inner = block.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "").trim()
    if (/(startDate|"Event"|location|address)/i.test(inner)) jsonld += inner + "\n"
  })
  jsonld = collapse_(jsonld).slice(0, 20000)

  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h\d)[^>]*>/gi, " \n ")
    .replace(/<[^>]+>/g, " ")
  text = collapse_(decodeEntities_(text)).slice(0, 60000)   // full text kept for the fill-in pass; trimmed per prompt

  return { jsonld: jsonld, text: text }
}

function decodeEntities_(s) {
  return (s || "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/&#8217;/g, "'").replace(/&#8216;/g, "'")
    .replace(/&#8211;/g, "-").replace(/&#8212;/g, "-").replace(/&#8230;/g, "...")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
}

function callClaude_(apiKey, prompt, maxTokens) {
  const payload = {
    model:      PIPELINE_CONFIG.CLAUDE_MODEL,
    max_tokens: maxTokens || PIPELINE_CONFIG.CLAUDE_MAX_TOKENS,
    messages:   [{ role: "user", content: prompt }]
    // Do NOT add temperature/top_p/top_k on Sonnet 5 -- non-default values return a 400.
  }

  const response = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
    method:      "post",
    contentType: "application/json",
    headers: {
      "x-api-key":         apiKey,
      "anthropic-version": "2023-06-01"
    },
    payload:            JSON.stringify(payload),
    muteHttpExceptions: true
  })
  if (response.getResponseCode() !== 200) {
    Logger.log("Claude API error: " + response.getContentText())
    return ""
  }

  const data = JSON.parse(response.getContentText())
  if (data.stop_reason === "max_tokens") {
    Logger.log("WARNING: Claude hit max_tokens -- output may be truncated. Raise CLAUDE_MAX_TOKENS.")
  }

  const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n")
  Logger.log("Claude response length: " + text.length)
  return text
}

function buildPipelinePrompt_(searchResults, pages, dateStr) {
  // Every event we already have that hasn't ended (any month, any status, including Rejected)
  const existing = getUpcomingEventRows_()
    .map(r => {
      const name = (r["Event Name"] || "").toString().trim()
      return name ? `${name} (${(r["Date"] || "no date").toString()})` : ""
    })
    .filter(Boolean)

  const searchBlock = searchResults.map((s, i) =>
    `SEARCH ${i + 1}: ${s.query}\n` +
    (s.hits.length === 0
      ? "  No results.\n"
      : s.hits.map(h => `  - ${h.title}\n    ${h.url}\n    ${h.description}${h.extra ? "\n    " + h.extra : ""}`).join("\n"))
  ).join("\n\n")

  const pageBlock = pages.length === 0
    ? "None fetched."
    : pages.map((p, i) =>
        `PAGE ${i + 1}: ${p.title}\nURL: ${p.url}\n` +
        (p.jsonld ? `STRUCTURED DATA (schema.org, trust this for dates/times/venue):\n${p.jsonld.slice(0, PIPELINE_CONFIG.JSONLD_CHAR_LIMIT)}\n` : "") +
        `PAGE TEXT:\n${p.text.slice(0, PIPELINE_CONFIG.PAGE_CHAR_LIMIT)}`
      ).join("\n\n---\n\n")

  return `You are running the Elite Spaces weekly events pipeline for ${dateStr}. Elite Spaces is an upscale NYC social and beauty industry website.

TARGET AUDIENCE: Upscale NYC professionals. High-vibe = luxury brand activations, beauty pop-ups, art fairs, galas. Low-vibe = mass-market, generic, youth-targeted.

You have TWO tiers of data. Use only this data, do not search again.
1. FETCHED PAGES: full text and structured data from the actual pages. Authoritative. Use FIRST for Date, Time, Location.
2. SEARCH RESULTS: short snippets. Use for breadth and for events without a fetched page.

## FETCHED PAGES
${pageBlock}

## SEARCH RESULTS
${searchBlock}

## EVENTS ALREADY IN OUR SHEET (do NOT return these again, even if worded differently or found on another site)
${existing.length ? existing.join("\n") : "None."}

## STEP 1 — EXTRACT every NYC-area event dated ${dateStr} or later that is not already in our sheet.
- Return each real-world event ONCE. If several pages mention the same event, merge them into one entry using the most specific details.
- Source URL: the most specific page for that event (official, venue or ticket page) rather than a roundup article, when you have one.

## STEP 2 — DATE, TIME & LOCATION FORMAT (strict)
- Date: "Month D, YYYY" for one day, "Month D-D, YYYY" for a range in one month, "Month D - Month D, YYYY" across months. Full month names. Example: "September 16 - October 18, 2026".
- If you cannot find the exact day, write only what you know (e.g. "September 2026") and say what is missing in Notes. Never invent a day.
- Time: "7:00 PM" or "6:30 PM - 9:30 PM". If the start time is not stated anywhere in the data, write "TBD". Never write "Evening", "Hours vary", "Varies" or similar.
- Location: venue name plus street address when stated, e.g. "The Plaza Hotel, 768 Fifth Avenue, NYC". If unknown, "TBD, NYC".
- schema.org startDate/endDate/location is the source of truth when present.
- Each event's Notes describe THAT event only. Never copy another event's venue, date, price or instructions.

## STEP 3 — SCORE each event 1-10:
9-10: Luxury venue & elite networking (Lincoln Center, The Met, Ritz-Carlton, Frieze)
8: Upscale neighborhoods (Tribeca, UES, SoHo), premium beauty brands (Fenty, Lancome, YSL, Dior)
7: Wellness (ALO Yoga), arts benefits, indie beauty, curated vintage
6: Aspirational but broad: neighborhood events, solid brand activations, mid-tier galas
5: Decent general-interest event with some upscale or editorial appeal
4 or below: Mass-market, off-brand, no aspirational angle at all
Include every event down to a score of 4, with an honest score. Flag events within 48 hours of ${dateStr} as URGENT in Notes.

## STEP 4 — CATEGORIES: use only these words, comma-separated, no spaces: gala, beauty, popup, art, industry, free

## STEP 5 — UPDATES: if the data shows an event in our sheet was cancelled, moved, or now has a confirmed date/time/venue, list it under "updates".

## STEP 6 — RETURN ONLY this JSON, nothing else:

\`\`\`json
{
  "events": [
    {
      "Event Name": "Example Gala",
      "Date": "May 22, 2026",
      "Time": "7:00 PM",
      "Location": "Lincoln Center, 10 Lincoln Center Plaza, NYC",
      "Description": "One sentence description.",
      "Source URL": "https://example.com",
      "Vibe Score": "9 - Lincoln Center luxury gala",
      "Notes": "",
      "Categories": "gala,art",
      "isFree": false
    }
  ],
  "updates": [
    { "Event Name": "Name exactly as in our sheet", "Change": "What changed, with the source URL" }
  ]
}
\`\`\`

Keep every Description to ONE sentence so the JSON stays compact.`
}

// Second pass for events with a missing day, time or venue: re-reads the event's own source page
// (focused on the part that mentions it) and asks Claude for only what the page states. Edits events in place.
function fillMissingDetails_(apiKey, events, pages) {
  const needs = events
    .map((ev, i) => ({ ev, i }))
    .filter(x => x.ev["Source URL"] && (
      !parseEventDateRange_(normalizeDateText_(x.ev["Date"])).isExactDay ||
      isVagueTime_(normalizeTimeText_(x.ev["Time"], Session.getScriptTimeZone(), false)) ||
      isVagueLocation_(x.ev["Location"])))
    .slice(0, PIPELINE_CONFIG.MAX_FILL_IN_EVENTS)
  if (!needs.length) return 0

  const pageByUrl = {}
  pages.forEach(p => { pageByUrl[p.url] = p })
  const missing = [...new Set(needs.map(x => x.ev["Source URL"]).filter(u => !pageByUrl[u]))]
  fetchPagesParallel_(missing).forEach(p => { pageByUrl[p.url] = p })

  const blocks = []
  needs.forEach((x, n) => {
    const page = pageByUrl[x.ev["Source URL"]]
    if (!page) return
    const excerpt = excerptAround_(page.text, x.ev["Event Name"], PIPELINE_CONFIG.FILL_IN_EXCERPT_CHARS)
    const nameTokens = tokenize_(x.ev["Event Name"]).filter(t => t.length > 3)
    const jsonld = page.jsonld && nameTokens.some(t => normalizeText_(page.jsonld).includes(t)) ? page.jsonld.slice(0, 2000) : ""
    blocks.push(
      `EVENT ${n + 1}\nName: ${x.ev["Event Name"]}\n` +
      `Known so far: Date "${x.ev["Date"] || ""}" | Time "${x.ev["Time"] || ""}" | Location "${x.ev["Location"] || ""}"\n` +
      `Source: ${x.ev["Source URL"]}\n` +
      (jsonld ? `STRUCTURED DATA: ${jsonld}\n` : "") +
      `PAGE EXCERPT: ${excerpt}`
    )
  })
  if (!blocks.length) return 0

  const prompt = `You are checking event details for the Elite Spaces NYC calendar. For each event below, read its page and return ONLY what the page explicitly states.

Rules:
- Date: exact day(s) as "Month D, YYYY", "Month D-D, YYYY" or "Month D - Month D, YYYY". If the page does not state an exact day, return "".
- Time: start time or start-end, like "7:00 PM" or "6:30 PM - 9:30 PM". If not stated, return "".
- Location: venue name plus street address if stated, e.g. "The Plaza Hotel, 768 Fifth Avenue, NYC". If not stated, return "".
- Never guess. Never use details that belong to a different event on the same page.
- If the page shows the event is cancelled, already over, or not the named event, put a short note in "Problem".

Return only JSON: {"fixes":[{"event":1,"Date":"","Time":"","Location":"","Problem":""}]}

${blocks.join("\n\n---\n\n")}`

  const text = callClaude_(apiKey, prompt, 6000)
  const parsed = tryParseJson_((text.match(/\{[\s\S]*\}/) || [""])[0])
  if (!parsed || !parsed.fixes) return 0

  let filled = 0
  parsed.fixes.forEach(f => {
    const x = needs[(parseInt(f.event, 10) || 0) - 1]
    if (!x) return
    const ev = x.ev
    let changed = false
    if (f.Date && parseEventDateRange_(f.Date).isExactDay && !parseEventDateRange_(normalizeDateText_(ev["Date"])).isExactDay) { ev["Date"] = f.Date; changed = true }
    if (f.Time && !isVagueTime_(f.Time) && isVagueTime_(normalizeTimeText_(ev["Time"], Session.getScriptTimeZone(), false))) { ev["Time"] = f.Time; changed = true }
    if (f.Location && !isVagueLocation_(f.Location) && isVagueLocation_(ev["Location"])) { ev["Location"] = f.Location; changed = true }
    if (f.Problem) ev["Notes"] = ((ev["Notes"] || "") + " CHECK: " + f.Problem).trim()
    if (changed) filled++
  })
  Logger.log("Fill-in pass completed details for " + filled + " event(s)")
  return filled
}

function excerptAround_(text, name, size) {
  const t = text || ""
  const lower = t.toLowerCase()
  const tokens = tokenize_(name).filter(w => w.length > 3).sort((a, b) => b.length - a.length)
  for (const tok of tokens) {
    const idx = lower.indexOf(tok)
    if (idx > -1) return t.slice(Math.max(0, idx - Math.floor(size / 3)), idx + Math.ceil(size * 2 / 3))
  }
  return t.slice(0, size)
}

function parseClaudeResponse_(text) {
  const result = { events: [], updates: [] }
  if (!text) return result

  let jsonStr = ""
  const fenced = text.match(/```json\s*([\s\S]*?)```/)
  if (fenced) {
    jsonStr = fenced[1].trim()
  } else {
    const brace = text.indexOf("{")
    if (brace > -1) jsonStr = text.slice(brace)
  }

  if (jsonStr) {
    const parsed = tryParseJson_(jsonStr)
    if (parsed) {
      result.events  = parsed.events  || []
      result.updates = parsed.updates || []
    } else {
      result.events = salvageEvents_(jsonStr)
      Logger.log("Primary JSON parse failed; salvaged " + result.events.length + " event(s).")
    }
  }
  return result
}

function tryParseJson_(s) {
  if (!s) return null
  try { return JSON.parse(s) } catch (e) {}
  const last = s.lastIndexOf("}")
  if (last > -1) { try { return JSON.parse(s.slice(0, last + 1)) } catch (e) {} }
  return null
}

function salvageEvents_(s) {
  const events = []
  const matches = s.match(/\{[^{}]*"Event Name"[^{}]*\}/g) || []
  matches.forEach(m => { try { events.push(JSON.parse(m)) } catch (e) {} })
  return events
}

// The weekly email is now built from what actually happened in the sheet, not from Claude's own summary.
function sendPipelineReport_(report, updates, stats, dateStr) {
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${EVENTS_SHEET_ID}/edit`
  const lines = []
  lines.push(`Elite Spaces Weekly Pipeline - ${dateStr}`, "")
  if (stats.claudeError) lines.push("PROBLEM: " + stats.claudeError, "")

  lines.push(`NEW EVENTS ADDED: ${report.added.length} (Status: Pending Review)`)
  const tiers = [[9, 10, "9-10"], [7, 8, "7-8"], [0, 6, "4-6"]]
  tiers.forEach(([lo, hi, label]) => {
    const inTier = report.added.filter(e => { const v = vibeScoreNumber_(e["Vibe Score"]); return v >= lo && v <= hi })
    if (!inTier.length) return
    lines.push("", `Vibe ${label}:`)
    inTier.forEach(e => {
      lines.push(`- ${e["Event Name"]}`)
      lines.push(`  ${e["Date"]} | ${e["Time"]} | ${e["Location"]}`)
      lines.push(`  ${e["Vibe Score"]}`)
      if (e["Notes"]) lines.push(`  Notes: ${e["Notes"]}`)
      lines.push(`  ${e["Source URL"]}`)
    })
  })

  if (report.updated.length) {
    lines.push("", `MISSING DETAILS FILLED IN ON EXISTING EVENTS: ${report.updated.length}`)
    report.updated.forEach(u => lines.push(`- Row ${u.row}: ${u.name}`, ...u.changes.map(c => `    ${c}`)))
  }

  if (updates.length) {
    lines.push("", "POSSIBLE CHANGES TO CHECK BY HAND (cancellations / moves):")
    updates.forEach(u => lines.push(`- ${u["Event Name"]}: ${u["Change"]}`))
  }

  if (report.needsDate.length) {
    lines.push("", `NOT ADDED, NO EXACT DATE YET: ${report.needsDate.length} (will be retried next run; add by hand if you know the date)`)
    report.needsDate.forEach(e => lines.push(`- ${e["Event Name"]} | ${e["Date"] || "no date"} | ${e["Source URL"]}`))
  }

  lines.push("", `Skipped as already in the sheet: ${report.duplicates.length}`)
  if (report.duplicates.length) lines.push(...report.duplicates.map(d => `  ${d}`))
  lines.push(`Dropped below vibe ${PIPELINE_CONFIG.MIN_SCORE_TO_INCLUDE}: ${stats.belowScore} | Dropped as already over: ${stats.past} | Details completed by second pass: ${stats.filledIn}`)
  lines.push("", `Sheet: ${sheetUrl}`, "Reminder: change Status to Approved before the first Sunday to publish.")

  const subject = `Elite Spaces Weekly -- ${report.added.length} New Events Added (${dateStr})`
  GmailApp.sendEmail(ADMIN_EMAIL, subject, lines.join("\n"))
  Logger.log("Email sent: " + subject)
}

// ── 12. SCHEDULED TASKS ───────────────────────────────────────────────────────

function runMonthlyPublish() {
  const months    = ["January","February","March","April","May","June","July","August","September","October","November","December"]
  const today     = new Date()
  const monthName = months[today.getMonth()]
  const year      = today.getFullYear()
  const dateStr   = monthName + " " + today.getDate() + ", " + year

  let publishedNames = []
  let publishedCount = 0
  let webhookError   = ""

  try {
    const data     = JSON.parse(handlePublishApproved({}).getContent())
    publishedNames = data.published || []
    publishedCount = data.count     || 0
  } catch (err) {
    webhookError = err.message
  }

  let body = monthName + " " + year + " -- Your calendar is now live on Elite Spaces.\n\n"

  if (webhookError) {
    body += "ERROR: The publish webhook failed. Details:\n" + webhookError + "\n\n"
    body += "Please publish manually by calling the publishApproved action on the webhook, or flip Approved events to Published directly in the sheet.\n\n"
  } else if (publishedCount === 0) {
    body += "No events had Status = Approved before the publish deadline, so nothing went live this month.\n\n"
    body += "Reminder: During the week before the first Sunday next month, open the sheet and change any events you want published to Status = Approved.\n\n"
  } else {
    body += publishedCount + " event" + (publishedCount === 1 ? "" : "s") + " published:\n\n"
    publishedNames.forEach(function(name) { body += "- " + name + "\n" })
    body += "\n"
  }

  body += "Google Sheet: https://docs.google.com/spreadsheets/d/1zrapP4xBWhlikvhGGPXiFjN-hDqzHUQs2bT8F-WBBr8/edit\n\n"
  body += "Members can now see this month's calendar at elitespaces.nyc."

  const subject = "Elite Spaces -- " + monthName + " Calendar Is Live (" + dateStr + ")"
  GmailApp.sendEmail("daniblackbeauty@gmail.com", subject, body)
  Logger.log("Email sent: " + subject)
}

function sendWeeklyEventDigest() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const sevenDaysOut = new Date(today)
  sevenDaysOut.setDate(sevenDaysOut.getDate() + 7)
  sevenDaysOut.setHours(23, 59, 59, 999)

  const rows     = getEventsSheetRows_()
  const upcoming = []

  rows.forEach(row => {
    const status = (row["Status"] || "").toString().trim()
    if (status !== "Published" && status !== "Approved") return

    const { startDate, endDate } = parseEventDateRange_(row["Date"] ? row["Date"].toString() : "")
    if (!startDate || !endDate) return

    if (startDate > sevenDaysOut || endDate < today) return

    upcoming.push({
      name:        (row["Event Name"]  || "").toString(),
      date:        (row["Date"]        || "").toString(),
      time:        (row["Time"]        || "").toString(),
      location:    (row["Location"]    || "").toString(),
      description: (row["Description"] || "").toString(),
      vibeScore:   (row["Vibe Score"]  || "").toString(),
      status:      status,
      categories:  (row["Categories"]  || "").toString(),
      fullDate:    startDate
    })
  })

  upcoming.sort((a, b) => a.fullDate - b.fullDate)

  const fmt      = { weekday: "long", month: "long", day: "numeric", year: "numeric" }
  const fromStr  = today.toLocaleDateString("en-US", fmt)
  const toStr    = sevenDaysOut.toLocaleDateString("en-US", fmt)
  const subject  = `Elite Spaces — Events This Week (${upcoming.length} upcoming)`

  if (upcoming.length === 0) {
    GmailApp.sendEmail(ADMIN_EMAIL, subject,
      `No published or approved events in the next 7 days (${fromStr} — ${toStr}).\n\nSheet: https://docs.google.com/spreadsheets/d/${EVENTS_SHEET_ID}/edit`
    )
    Logger.log("Weekly digest sent: 0 events")
    return
  }

  const eventCards = upcoming.map(event => `
    <div style="border-top:1px solid #e8e2da;padding:20px 0;">
      <p style="font-size:15px;font-weight:400;color:#3d2b20;margin-bottom:4px;">${event.name}</p>
      <p style="font-size:11px;font-weight:300;letter-spacing:0.08em;text-transform:uppercase;color:#9a8f87;margin-bottom:10px;">
        ${event.date}${event.time ? " · " + event.time : ""} · ${event.location}
      </p>
      <p style="font-size:13px;font-weight:300;line-height:1.8;color:#5a5550;margin-bottom:6px;">${event.description}</p>
      <p style="font-size:11px;color:#9a8f87;">
        Vibe: ${event.vibeScore} · ${event.status}${event.categories ? " · " + event.categories : ""}
      </p>
    </div>
  `).join("")

  const htmlBody = emailWrapper(`
    <p style="font-size:22px;font-weight:300;font-style:italic;line-height:1.5;margin-bottom:8px;">This Week</p>
    <p style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#8a8580;margin-bottom:32px;">${fromStr} — ${toStr}</p>
    <p style="font-size:13px;font-weight:300;color:#5a5550;margin-bottom:32px;">${upcoming.length} event${upcoming.length === 1 ? "" : "s"} coming up.</p>
    <div style="margin-bottom:32px;">${eventCards}</div>
    <div style="text-align:center;margin-top:32px;">
      <a href="https://docs.google.com/spreadsheets/d/${EVENTS_SHEET_ID}/edit" style="display:inline-block;background:#3d2b20;color:#F7F5F0;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;padding:14px 32px;text-decoration:none;">Open Sheet</a>
    </div>
  `)

  GmailApp.sendEmail(ADMIN_EMAIL, subject, "", {
    from:     FROM_EMAIL,
    name:     FROM_NAME,
    htmlBody: htmlBody
  })

  Logger.log("Weekly digest sent: " + upcoming.length + " events")
}


function runWeeklyPublish() {
  const ss    = SpreadsheetApp.openById(EVENTS_SHEET_ID)
  const sheet = ss.getSheetByName("Events")
  const rows  = getEventsSheetRows_()

  let publishedCount = 0

  rows.forEach(row => {
    if ((row["Status"] || "").toString().trim() === "Approved") {
      sheet.getRange(row._rowIndex, 8).setValue("Published")
      publishedCount++
    }
  })

  SpreadsheetApp.flush()
  Logger.log("Weekly publish complete: " + publishedCount + " event" + (publishedCount === 1 ? "" : "s") + " published")
}

// ── 13. EVENTS — SHEET CLEANUP ────────────────────────────────────────────────

// Puts the whole Events sheet into one consistent format and sorts it by date:
//  - Date and Time stored as plain text in one format (no more mix of real dates, "Jun 12" and "June 27-28")
//  - Vibe Score as "9 - reason", Categories limited to gala/beauty/popup/art/industry/free, isFree as TRUE/FALSE
//  - rows sorted by start date, events with no exact date at the bottom
// Safe to run any time. Runs automatically after each pipeline run when TIDY_SHEET_AFTER_RUN is true.
function tidyEventsSheet() {
  const sheet = getEventsSheet_()
  const tz    = sheet.getParent().getSpreadsheetTimeZone()
  const data  = sheet.getDataRange().getValues()
  if (data.length < 2) return

  const width   = Math.max(data[0].length, EVENT_HEADERS.length)
  const oldRows = data.slice(1).filter(r => r.some(c => c !== "" && c !== null))

  const rows = oldRows.map(r => {
    const out = r.slice()
    while (out.length < width) out.push("")
    const name = (out[EVENT_COLS.name - 1] || "").toString().trim()
    const desc = (out[EVENT_COLS.description - 1] || "").toString()
    const free = toBool_(out[EVENT_COLS.isFree - 1])
    const status = (out[EVENT_COLS.status - 1] || "").toString().trim()

    out[EVENT_COLS.name - 1]       = name
    out[EVENT_COLS.date - 1]       = normalizeDateText_(out[EVENT_COLS.date - 1])
    out[EVENT_COLS.time - 1]       = normalizeTimeText_(out[EVENT_COLS.time - 1], tz, false)
    out[EVENT_COLS.location - 1]   = collapse_(cleanDashes_(out[EVENT_COLS.location - 1]))
    out[EVENT_COLS.vibe - 1]       = normalizeVibeText_(out[EVENT_COLS.vibe - 1])
    out[EVENT_COLS.status - 1]     = status ? status.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : status
    out[EVENT_COLS.categories - 1] = cleanCategories_(out[EVENT_COLS.categories - 1], name, desc, free)
    out[EVENT_COLS.isFree - 1]     = free
    return out
  })

  const sortKey = r => {
    const range = parseEventDateRange_(r[EVENT_COLS.date - 1])
    if (range.isExactDay) return range.startDate.getTime()
    if (range.approxStart) return range.approxStart.getTime() + 1   // month-only dates sort at the start of their month
    return Number.MAX_SAFE_INTEGER
  }
  rows.sort((a, b) => (sortKey(a) - sortKey(b)) || a[0].toString().localeCompare(b[0].toString()))

  const formats = rows.map(() => {
    const f = new Array(width).fill("@")
    f[EVENT_COLS.isFree - 1] = "General"
    return f
  })

  sheet.getRange(2, 1, data.length - 1, width).clearContent()
  const target = sheet.getRange(2, 1, rows.length, width)
  target.setNumberFormats(formats)
  target.setValues(rows)
  sheet.setFrozenRows(1)
  SpreadsheetApp.flush()
  Logger.log("tidyEventsSheet: " + rows.length + " rows formatted and sorted")
}

// Moves events that ended more than ARCHIVE_AFTER_DAYS ago to an "Archive" tab so the Events tab
// only holds what's current and upcoming. Nothing is deleted outright. Good to run monthly.
function archivePastEvents() {
  const sheet = getEventsSheet_()
  const ss    = sheet.getParent()
  let archive = ss.getSheetByName("Archive")
  if (!archive) {
    archive = ss.insertSheet("Archive")
    archive.appendRow(EVENT_HEADERS)
    archive.setFrozenRows(1)
  }

  const cutoff = startOfDay_(new Date(Date.now() - PIPELINE_CONFIG.ARCHIVE_AFTER_DAYS * 86400000))
  const width  = sheet.getLastColumn()
  const toMove = getEventsSheetRows_().filter(row => {
    const r = parseEventDateRange_(row["Date"])
    return r.approxEnd && r.approxEnd < cutoff
  })
  if (!toMove.length) { Logger.log("archivePastEvents: nothing to archive"); return }

  const headers = sheet.getRange(1, 1, 1, width).getValues()[0].map(h => h.toString().trim())
  const values  = toMove.map(row => headers.map(h => row[h] === undefined ? "" : row[h]))
  const start  = archive.getLastRow() + 1
  const dest   = archive.getRange(start, 1, values.length, width)
  dest.setNumberFormat("@")
  dest.setValues(values)

  toMove.map(r => r._rowIndex).sort((a, b) => b - a).forEach(i => sheet.deleteRow(i))
  Logger.log("archivePastEvents: moved " + toMove.length + " row(s) to Archive")
}
