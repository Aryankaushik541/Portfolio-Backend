import nodemailer from "nodemailer";

let transporter = null;

// Lazily create a single reusable transporter. Using a Gmail account with an
// App Password (NOT your normal Gmail password — generate one at
// https://myaccount.google.com/apppasswords after enabling 2-Step Verification).
function getTransporter() {
  if (transporter) return transporter;

  const user = String(process.env.GMAIL_USER || "").trim();
  // Google displays app passwords with spaces for readability; SMTP requires
  // the 16-character value without them. Render may preserve pasted spaces.
  const pass = String(process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");

  if (!user || !pass) {
    throw new Error(
      "GMAIL_USER / GMAIL_APP_PASSWORD are not set. Add them to backend/.env to enable OTP emails."
    );
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE !== "false",
    auth: { user, pass },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });

  return transporter;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// Builds a clean, professional OTP email (works well across Gmail/Outlook/Apple Mail).
function buildOtpEmailHtml({ otp, minutesValid, appName }) {
  const safeOtp = escapeHtml(otp);
  const groupedOtp = safeOtp.split("").join(" ");

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f1ea;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
            <tr>
              <td style="background:#d97757;padding:24px 32px;">
                <p style="margin:0;color:#ffffff;font-size:18px;font-weight:600;letter-spacing:0.2px;">${escapeHtml(appName)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px 8px;">
                <p style="margin:0 0 8px;color:#1a1a1a;font-size:16px;">Your sign-in code</p>
                <p style="margin:0 0 28px;color:#6b6b6b;font-size:14px;line-height:1.5;">
                  Use the code below to finish signing in. This code is valid for
                  <strong>${minutesValid} minutes</strong> and can only be used once.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px;">
                <div style="background:#f4f1ea;border-radius:12px;padding:20px;text-align:center;">
                  <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#1a1a1a;font-family:'Courier New',monospace;">${groupedOtp}</span>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;">
                <p style="margin:0;color:#8a8a8a;font-size:12.5px;line-height:1.6;">
                  If you didn't request this code, you can safely ignore this email —
                  no one can access your account without it.
                </p>
              </td>
            </tr>
            <tr>
              <td style="background:#faf9f5;padding:16px 32px;border-top:1px solid #eee;">
                <p style="margin:0;color:#b0b0b0;font-size:11.5px;">This is an automated message, please don't reply.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendOtpEmail({ to, otp, minutesValid = 10 }) {
  const appName = process.env.APP_NAME || "Portfolio Admin";
  const t = getTransporter();

  await t.sendMail({
    from: `"${appName}" <${String(process.env.GMAIL_USER || "").trim()}>`,
    to,
    subject: `${otp} is your sign-in code`,
    text: `Your sign-in code is ${otp}. It is valid for ${minutesValid} minutes. If you didn't request this, ignore this email.`,
    html: buildOtpEmailHtml({ otp, minutesValid, appName }),
  });
}
