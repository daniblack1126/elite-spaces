# Elite Spaces NYC

A curated monthly events calendar for New York City. Members apply, get approved by hand, pay through Stripe, then sign in with an emailed link to see the full calendar.

## How the pieces connect

```
Visitor's browser
   │
   ▼
elitespaces.nyc  (this repo, Next.js on Vercel)
   │  /api/apply   /api/login   /api/verify   /api/events   /api/cancel
   │  /api/stripe  ◄── Stripe webhook (signature checked here)
   ▼
Google Apps Script web app  (apps-script/Code.gs)
   │  sends every email (GmailApp), runs the weekly events pipeline,
   │  drip emails and monthly publish on time-based triggers
   ▼
Google Sheets
   ├─ Members tab   (one row per applicant / member)
   └─ Events sheet  (one row per event; Status: Pending Review → Approved → Published)
```

The website never touches the sheets directly. Everything goes through the Apps Script, using the URL in `APPS_SCRIPT_URL`.

## Vercel environment variables

| Name | What it is |
|---|---|
| `APPS_SCRIPT_URL` | The Apps Script web app URL (ends in `/exec`) |
| `APPS_SCRIPT_SECRET` | Long random string. Same value as the `SITE_SECRET` Script Property |
| `SESSION_SECRET` | Long random string used to sign the login cookie |
| `STRIPE_SECRET_KEY` | Stripe secret key (also used to stop renewals when a member cancels) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret of the Stripe webhook that points at `https://elitespaces.nyc/api/stripe` |
| `STRIPE_MONTHLY_LINK` / `STRIPE_FOUNDING_LINK` | Stripe Payment Link URLs |

## Apps Script setup

1. Paste `apps-script/Code.gs` over everything in the Apps Script editor and save.
2. Project Settings → Script Properties:
   - `ANTHROPIC_API_KEY`, `BRAVE_API_KEY` for the events pipeline
   - `SITE_SECRET` = the same value as `APPS_SCRIPT_SECRET` in Vercel
   - `BYPASS_SECRET` = a new private value, only if you use free-access links
3. Deploy → Manage deployments → edit the existing web app → New version. Editing the existing deployment keeps the URL the same.
4. Triggers: `onEdit` (from spreadsheet, on edit), `runEventsPipeline` (weekly), `runApprovedNotPaidDrip` (daily), `runMonthlyPublish` (monthly), `sendWeeklyEventDigest` (weekly). Have only one trigger per function.

Cleanup functions you can run by hand from the editor: `tidyEventsSheet`, `reportDuplicates` (dry run, emails a list), `mergeDuplicates`, `archivePastEvents`.

## Member flow

1. Access form → `/api/apply` → Apps Script adds a Members row (`pending`) and sends the confirmation and admin emails.
2. You set Application Status to `approved` → the `onEdit` trigger sets `payment_pending` and emails the payment links.
3. Member pays → Stripe → `/api/stripe` → Apps Script sets `active` and sends the welcome email.
4. Member signs in → `/api/login` emails a 15-minute link → `/api/verify` checks it and sets a signed session cookie.
5. Member cancels → `/api/cancel` stops the Stripe renewal and marks the row `cancelling`. When the paid period ends, Stripe sends `customer.subscription.deleted` and the row becomes `cancelled`.

Free access: `https://script.google.com/macros/s/<id>/exec?action=bypass&email=EMAIL&plan=monthly&secret=<BYPASS_SECRET>` (the person must have applied first).

## Local development

```bash
npm install
cp .env.local.example .env.local   # fill in values
npm run dev
```
