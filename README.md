# Elite Spaces NYC

A curated monthly events calendar for New York City. Members apply for access, get manually approved, pay via Stripe, then log in with a magic link to see the full calendar.

Built with **Next.js 14 (App Router)**, **Google Sheets**, **Stripe**, and **Nodemailer**.

---

## Architecture

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 App Router, Framer Motion, inline styles (design-token system) |
| Auth | Magic-link email → hash-based URL → httpOnly session cookie |
| Database | Google Sheets (one row per member) |
| Payments | Stripe Payment Links + webhook |
| Email | Nodemailer (any SMTP provider) |
| Hosting | Vercel |

---

## Setup

### 1. Clone and install

```bash
git clone <repo>
cd elite-spaces-nyc
npm install
```

### 2. Google Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → Create project (or reuse one).
2. Enable **Google Sheets API**.
3. Create a **Service Account** (IAM & Admin → Service Accounts → Create).
4. Create a JSON key for that service account and download it.
5. Open your Google Sheet → Share → paste the service account email with **Editor** access.
6. Copy the values into your env file:
   - `GOOGLE_SHEET_ID` — from the sheet URL: `https://docs.google.com/spreadsheets/d/<ID>/edit`
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL` — the `client_email` field in the JSON key
   - `GOOGLE_PRIVATE_KEY` — the `private_key` field (keep the `\n` escapes; Vercel handles them correctly)

### 3. Google Sheet column structure

The sheet must have these columns in order (row 1 = headers, data starts row 2):

| Col | Header | Values |
|---|---|---|
| A | Timestamp | ISO datetime |
| B | First Name | string |
| C | Last Name | string |
| D | Email | string |
| E | Source | tiktok / friend / google / instagram / other |
| F | Status | pending / approved / payment_pending / monthly_member / founding_member / cancelling / cancelled / payment_failed |
| G | Stripe Customer ID | string |
| H | Stripe Subscription ID | string |
| I | Plan | monthly / founding |
| J | Login Token | string (cleared after use) |
| K | Token Expiry | ISO datetime (cleared after use) |
| L | Applied At | ISO datetime |
| M | Approved At | ISO datetime |
| N | Payment Date | ISO datetime |
| O | Next Billing Date | ISO datetime |
| P | Cancelled At | ISO datetime |
| Q | Notes | string |

### 4. SMTP (email sending)

Any SMTP provider works. Recommended options:
- **Resend** — `smtp.resend.com`, port 465, your Resend API key as the password
- **Postmark** — `smtp.postmarkapp.com`, port 587
- **Gmail** — only for testing; use an App Password

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`.

### 5. Stripe

1. Create two **Payment Links** in the Stripe Dashboard — one for Monthly ($12/mo) and one for Founding ($99/yr).
2. Copy each link URL into `STRIPE_MONTHLY_LINK` and `STRIPE_FOUNDING_LINK`.
3. Set up a **Webhook** pointing to `https://your-domain.vercel.app/api/stripe`:
   - Events to listen for: `checkout.session.completed`, `customer.subscription.deleted`, `invoice.payment_failed`
4. Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.
5. Copy your Stripe secret key into `STRIPE_SECRET_KEY`.

### 6. Environment variables

Copy `.env.local.example` to `.env.local` and fill in all values:

```bash
cp .env.local.example .env.local
```

Then add the same variables in the Vercel project dashboard (Settings → Environment Variables).

### 7. Deploy to Vercel

```bash
npx vercel
```

Or connect the GitHub repo in the Vercel dashboard. The `vercel.json` file handles the build config automatically.

---

## Member approval workflow

1. A visitor fills in the **Request Access** form → row added to sheet with status `pending`, confirmation email sent to applicant, notification email sent to admin.
2. Admin opens the sheet, reviews the row, sets status to `approved`.
3. **Admin manually sends the payment email** by calling the approval function (see below), or you can set up an on-edit trigger in Google Sheets/Apps Script that watches column F.
4. Member receives an email with Monthly / Founding payment links.
5. Member pays → Stripe fires `checkout.session.completed` → webhook updates sheet to `monthly_member` or `founding_member`, sends welcome email.
6. Member returns to the site, enters email in the **Member sign in** section, receives magic link, clicks it, and gets access.

> **Note:** To automate step 3 without Apps Script, you can manually send the payment email by updating the status and calling the `lib/email.ts` `paymentEmail()` function from a script or admin page.

---

## Bypass URL (manual access without payment)

Grant access to yourself or guests without requiring payment:

```
https://your-domain.vercel.app/api/bypass?email=EMAIL&plan=monthly&secret=elitespaces2026
```

- `email` — must already have a row in the sheet (they applied first)
- `plan` — `monthly` or `founding`
- `secret` — value of `BYPASS_SECRET` env var (default: `elitespaces2026`)

The person will receive a welcome email and their status will be updated in the sheet.

---

## Magic link flow

1. Member enters email in **Member sign in** section.
2. `/api/login` generates a token, stores it in the sheet with a 15-minute expiry, sends an email with a link like: `https://your-domain.vercel.app#token=TOKEN&email=EMAIL`
3. Member clicks the link → page loads → Hero component reads the hash, calls `/api/verify`.
4. `/api/verify` validates the token, clears it from the sheet, sets an httpOnly cookie.
5. Page reloads with the session cookie → server component reads cookie → authenticated view shown.

---

## Local development

```bash
npm run dev
```

Visit `http://localhost:3000`. Set `NEXT_PUBLIC_SITE_URL=http://localhost:3000` in `.env.local` so magic links point to localhost.
