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
        <p style="font-size:11px;letter-spacing:0.12em;color:#8a8580;margin:0;">Elite Spaces &nbsp;·&nbsp; <a href="https://elitespaces.nyc" style="color:#8a8580;text-decoration:none;">elitespaces.nyc</a></p>
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
    <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-bottom:20px;">We've received your application and it's now under review. We go through each one personally — so you can expect to hear from us within the week.</p>
    <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-bottom:20px;">Elite Spaces is a curated monthly briefing for people who move through New York with intention — the restaurants worth reserving, the openings worth attending, the rooms worth knowing about. Sourced from hundreds of publications so you don't have to be.</p>
    <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;">In the meantime, follow along on <a href="${TIKTOK_URL}" style="color:#3d2b20;">TikTok</a> for a preview of what's inside.</p>
  `)
}

export function paymentEmail(firstName: string, email: string) {
  return wrap(`
    <p style="font-size:22px;font-weight:300;font-style:italic;line-height:1.5;margin-bottom:24px;">You're in, ${firstName}.</p>
    <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-bottom:8px;">Your application has been approved. Choose your membership below to unlock your personal calendar — updated the first Sunday of every month.</p>
    <p style="font-size:14px;font-weight:300;line-height:1.9;color:#5a5550;margin-bottom:32px;">Both plans include full access to the Elite Spaces calendar. No ads, ever.</p>
    <div style="border:0.5px solid #C8C5BC;padding:24px;margin-bottom:16px;text-align:center;">
      <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#8a8580;margin-bottom:8px;">Monthly</p>
      <p style="font-size:32px;font-weight:300;color:#3d2b20;margin-bottom:2px;">$12<span style="font-size:14px;color:#8a8580;">/mo</span></p>
      <p style="font-size:11px;color:#8a8580;margin-bottom:20px;">Billed monthly · cancel anytime</p>
      <a href="${MONTHLY_LINK}?prefilled_email=${encodeURIComponent(email)}" style="display:inline-block;background:#3d2b20;color:#F7F5F0;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;padding:14px 32px;text-decoration:none;">Get Monthly Access</a>
    </div>
    <div style="border:0.5px solid #3d2b20;padding:24px;text-align:center;background:#faf9f6;">
      <p style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#8a8580;margin-bottom:4px;">Founding Member</p>
      <p style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#3d2b20;margin-bottom:12px;">— Limited availability —</p>
      <p style="font-size:32px;font-weight:300;color:#3d2b20;margin-bottom:2px;">$99<span style="font-size:14px;color:#8a8580;">/yr</span></p>
      <p style="font-size:11px;color:#8a8580;margin-bottom:4px;">Billed annually · save $45 vs monthly</p>
      <p style="font-size:11px;color:#8a8580;margin-bottom:20px;">Your rate is locked in forever, even as prices increase</p>
      <a href="${FOUNDING_LINK}?prefilled_email=${encodeURIComponent(email)}" style="display:inline-block;background:#3d2b20;color:#F7F5F0;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;padding:14px 32px;text-decoration:none;">Become a Founding Member</a>
    </div>
    <p style="font-size:11px;color:#8a8580;margin-top:20px;text-align:center;">Your spot is reserved. Complete checkout to activate your access.</p>
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
