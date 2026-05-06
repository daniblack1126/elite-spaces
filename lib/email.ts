import nodemailer from "nodemailer"

const SITE_URL    = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
const TIKTOK_URL  = process.env.TIKTOK_URL ?? "https://www.tiktok.com/@daniblackbeauty"
const MONTHLY_LINK  = process.env.STRIPE_MONTHLY_LINK ?? ""
const FOUNDING_LINK = process.env.STRIPE_FOUNDING_LINK ?? ""

function getTransporter() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
}

function wrap(content: string) {
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

export async function sendEmail(to: string, subject: string, html: string) {
  const transporter = getTransporter()
  await transporter.sendMail({
    from:    `"Elite Spaces NYC" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  })
}

export function approvalConfirmationEmail(firstName: string) {
  return wrap(`
    <p style="font-size:22px;font-weight:300;font-style:italic;line-height:1.5;margin-bottom:24px;">Hi ${firstName},</p>
    <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-bottom:20px;">Thank you for requesting access to Elite Spaces. We review each application personally and will be in touch within one week.</p>
    <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;">In the meantime, follow along on <a href="${TIKTOK_URL}" style="color:#3d2b20;">TikTok</a> for a preview of what's inside.</p>
  `)
}

export function paymentEmail(firstName: string, email: string) {
  return wrap(`
    <p style="font-size:22px;font-weight:300;font-style:italic;line-height:1.5;margin-bottom:24px;">Hi ${firstName},</p>
    <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-bottom:32px;">Your application has been approved. Choose your membership below to unlock your personal calendar.</p>
    <div style="border:0.5px solid #C8C5BC;padding:24px;margin-bottom:16px;text-align:center;">
      <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#8a8580;margin-bottom:8px;">Monthly</p>
      <p style="font-size:28px;font-weight:300;color:#3d2b20;margin-bottom:4px;">$12</p>
      <p style="font-size:11px;color:#8a8580;margin-bottom:16px;">per month · cancel anytime</p>
      <a href="${MONTHLY_LINK}?prefilled_email=${encodeURIComponent(email)}" style="display:inline-block;background:#3d2b20;color:#F7F5F0;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;padding:14px 32px;text-decoration:none;">Choose Monthly</a>
    </div>
    <div style="border:0.5px solid #3d2b20;padding:24px;text-align:center;">
      <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#8a8580;margin-bottom:8px;">Founding Member</p>
      <p style="font-size:28px;font-weight:300;color:#3d2b20;margin-bottom:4px;">$99</p>
      <p style="font-size:11px;color:#8a8580;margin-bottom:16px;">per year · locked-in rate forever</p>
      <a href="${FOUNDING_LINK}?prefilled_email=${encodeURIComponent(email)}" style="display:inline-block;background:#3d2b20;color:#F7F5F0;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;padding:14px 32px;text-decoration:none;">Choose Founding</a>
    </div>
  `)
}

export function welcomeEmail(firstName: string) {
  return wrap(`
    <p style="font-size:22px;font-weight:300;font-style:italic;line-height:1.5;margin-bottom:24px;">Welcome, ${firstName}.</p>
    <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-bottom:32px;">Your membership is active. Sign in below to access your personal calendar.</p>
    <div style="text-align:center;">
      <a href="${SITE_URL}" style="display:inline-block;background:#3d2b20;color:#F7F5F0;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;padding:14px 32px;text-decoration:none;">Access My Calendar</a>
    </div>
  `)
}

export function loginEmail(firstName: string, loginUrl: string) {
  return wrap(`
    <p style="font-size:22px;font-weight:300;font-style:italic;line-height:1.5;margin-bottom:24px;">Hi ${firstName},</p>
    <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-bottom:32px;">Click below to sign in to your calendar. This link expires in 15 minutes.</p>
    <div style="text-align:center;margin-bottom:32px;">
      <a href="${loginUrl}" style="display:inline-block;background:#3d2b20;color:#F7F5F0;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;padding:14px 32px;text-decoration:none;">Sign In to Elite Spaces</a>
    </div>
    <p style="font-size:11px;color:#8a8580;text-align:center;">If you didn't request this link, you can safely ignore this email.</p>
  `)
}

export function cancellationEmail(firstName: string) {
  return wrap(`
    <p style="font-size:22px;font-weight:300;font-style:italic;line-height:1.5;margin-bottom:24px;">Hi ${firstName},</p>
    <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-bottom:20px;">Your cancellation has been received. You'll retain access until the end of your current billing period.</p>
    <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;">We hope to see you back in the future.</p>
  `)
}

export function paymentFailedEmail(firstName: string) {
  return wrap(`
    <p style="font-size:22px;font-weight:300;font-style:italic;line-height:1.5;margin-bottom:24px;">Hi ${firstName},</p>
    <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-bottom:32px;">We had trouble processing your payment. Please update your payment method to keep your access active.</p>
    <div style="text-align:center;">
      <a href="${SITE_URL}" style="display:inline-block;background:#3d2b20;color:#F7F5F0;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;padding:14px 32px;text-decoration:none;">Update Payment</a>
    </div>
  `)
}
