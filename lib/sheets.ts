import { google } from "googleapis"

const SHEET_NAME = "Sheet1"

export const COL = {
  timestamp:            1,
  firstName:            2,
  lastName:             3,
  email:                4,
  source:               5,
  applicationStatus:    6,  // you fill: pending / approved / rejected
  memberStatus:         7,  // auto:     payment_pending / active / cancelling / cancelled / payment_failed
  stripeCustomerId:     8,
  stripeSubscriptionId: 9,
  plan:                 10,
  loginToken:           11,
  tokenExpiry:          12,
  appliedAt:            13,
  approvedAt:           14,
  paymentDate:          15,
  nextBillingDate:      16,
  cancelledAt:          17,
  notes:                18,
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
    range: `${SHEET_NAME}!A:R`,
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
    range:           `${SHEET_NAME}!A:R`,
    valueInputOption: "USER_ENTERED",
    requestBody:     { values: [serialised] },
  })
}
