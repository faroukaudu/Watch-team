const nodemailer = require("nodemailer");

async function emailSent({
  sendTo: to,
  title: subject,
  message: text,
  template: html,
}) {
  if (!to) {
    throw new Error("Email recipient is required.");
  }

  if (!subject) {
    throw new Error("Email subject is required.");
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 465);
  const smtpSecure =
    String(process.env.SMTP_SECURE || "true").toLowerCase() === "true";

  if (!smtpHost || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error(
      "SMTP_HOST, SMTP_USER, and SMTP_PASS must be configured."
    );
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false, // Port 587 uses STARTTLS

    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },

    requireTLS: true,

    tls: {
        rejectUnauthorized: true,
        servername: process.env.SMTP_HOST,
    },
});

  const fromName =
    process.env.EMAIL_FROM_NAME || "Watch Team";

  const fromAddress =
    process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER;

  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    replyTo:
      process.env.EMAIL_REPLY_TO || fromAddress,
    to,
    subject,
    text,
    html,
  });

  console.log("Email accepted:", {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
  });

  return info;
}

async function verifyEmailConnection() {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure:
      String(process.env.SMTP_SECURE || "true").toLowerCase() === "true",

    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },

    tls: {
      rejectUnauthorized: true,
      servername: process.env.SMTP_HOST,
    },
  });

  await transporter.verify();
  console.log("Watch Team SMTP connection verified successfully.");
}

module.exports = {
  emailSent,
  verifyEmailConnection,
};