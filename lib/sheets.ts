import { google } from "googleapis"

const SHEET_NAME = "Sheet1"

export const COL = {
  timestamp:            1,
  firstName:            2,
  lastName:             3,
  email:                4,
  source:               5,
  handle:               6,  // Instagram / TikTok handle
  applicationStatus:    7,  // you fill: pending / approved / rejected
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

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key:  process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  })
}

async function getSheets() {
  const auth = getAuth()
  return google.sheets({ version: "v4", auth })
}

export async function findRowByEmail(email: string) {
  const sheets = await getSheets()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${SHEET_NAME}!A:S`,
  })
  const rows = res.data.values ?? []
  const emailLower = email.toLowerCase()
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][COL.email - 1] ?? "").toLowerCase() === emailLower) {
      return { row: i + 1, data: rows[i] as string[] }
    }
  }
  return null
}

export async function updateCell(
  row: number,
  col: number,
  value: string | Date,
) {
  const sheets = await getSheets()
  const colLetter = String.fromCharCode(64 + col)
  const cellValue = value instanceof Date ? value.toISOString() : value
  await sheets.spreadsheets.values.update({
    spreadsheetId:   process.env.GOOGLE_SHEET_ID,
    range:           `${SHEET_NAME}!${colLetter}${row}`,
    valueInputOption: "RAW",
    requestBody:     { values: [[cellValue]] },
  })
}

export async function appendRow(values: (string | Date | number | null)[]) {
  const sheets = await getSheets()
  const serialised = values.map((v) =>
    v instanceof Date ? v.toISOString() : (v ?? ""),
  )
  await sheets.spreadsheets.values.append({
    spreadsheetId:   process.env.GOOGLE_SHEET_ID,
    range:           `${SHEET_NAME}!A:S`,
    valueInputOption: "USER_ENTERED",
    requestBody:     { values: [serialised] },
  })
}
