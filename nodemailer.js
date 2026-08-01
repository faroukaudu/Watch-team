const nodemailer = require("nodemailer");
require('dotenv').config();

/**
 * Send an application email and resolve only after the SMTP provider
 * confirms that the message was accepted. Existing callers can continue
 * using the same argument structure.
 */
async function emailSent({
  sendTo: to,
  title: subject,
  message: text,
  template: html,
}) {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    service: process.env.SERVER_SERVICE,
    tls: {
      rejectUnauthorized: true,
      servername: process.env.SERVER_NAME,
    },
    auth: {
      user:
        process.env.WATCHTEAM_EMAIL_USER ||
        process.env.SERVER_EMAIL,
      pass: process.env.WATCHTEAM_EMAIL_PASSWORD || process.env.SERVER_PASSWORD,
    },
  });

  const info = await transporter.sendMail({
    from:
      process.env.WATCHTEAM_EMAIL_FROM ||
      "Watch Team Security <noreply.secure-watch-team@gmail.com>",
    replyTo:
      process.env.WATCHTEAM_EMAIL_REPLY_TO ||
      "noreply.secure-watch-team@gmail.com",
    to,
    subject,
    text,
    html,
  });

  console.log("Email accepted by SMTP provider:", info.messageId);
  return info;
}

module.exports = { emailSent };