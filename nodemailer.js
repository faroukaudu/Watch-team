// LIVE WORKING
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
    // port: 587,
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


// LOCAL HOST WORKING
// const nodemailer = require("nodemailer");
// require("dotenv").config();

// async function emailSent({
//   sendTo: to,
//   title: subject,
//   message: text,
//   template: html,
// }) {
//   const emailUser =
//     process.env.WATCHTEAM_EMAIL_USER ||
//     process.env.SERVER_EMAIL;

//   const emailPassword =
//     process.env.WATCHTEAM_EMAIL_PASSWORD ||
//     process.env.SERVER_PASSWORD;

//   const transporter = nodemailer.createTransport({
//     host: "smtp.gmail.com",
//     port: 587,
//     secure: false,
//     requireTLS: true,

//     auth: {
//       user: emailUser,
//       pass: emailPassword,
//     },

//     tls: {
//       rejectUnauthorized: true,
//       servername: "smtp.gmail.com",
//     },

//     connectionTimeout: 30000,
//     greetingTimeout: 30000,
//     socketTimeout: 60000,
//   });

//   const info = await transporter.sendMail({
//     from:
//       process.env.WATCHTEAM_EMAIL_FROM ||
//       `Watch Team Security <${emailUser}>`,

//     replyTo:
//       process.env.WATCHTEAM_EMAIL_REPLY_TO ||
//       emailUser,

//     to,
//     subject,
//     text,
//     html,
//   });

//   console.log("Email accepted by SMTP provider:", info.messageId);

//   return info;
// }

// module.exports = { emailSent };