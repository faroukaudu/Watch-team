const nodemailer = require("nodemailer");
const ejs = require("ejs");
const path = require("path");
const fs = require("fs");

class EmailService {
    constructor() {
        this.transporter = null;
    }

    /**
     * Create and reuse one Nodemailer transporter.
     */
    getTransporter() {
        if (this.transporter) {
            return this.transporter;
        }

        const requiredEnvironmentVariables = [
            "SMTP_HOST",
            "SMTP_PORT",
            "SMTP_USER",
            "SMTP_PASS",
            "EMAIL_FROM_ADDRESS",
        ];

        const missingVariables = requiredEnvironmentVariables.filter(
            (variableName) => !process.env[variableName]
        );

        if (missingVariables.length > 0) {
            throw new Error(
                `Missing email environment variables: ${missingVariables.join(", ")}`
            );
        }

        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 465),
            secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",

            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },

            // Useful for cPanel SMTP connections.
            tls: {
                rejectUnauthorized:
                    process.env.NODE_ENV === "production",
            },

            connectionTimeout: 15000,
            greetingTimeout: 15000,
            socketTimeout: 30000,
        });

        return this.transporter;
    }

    /**
     * Return the default Watch Team sender.
     */
    getDefaultSender() {
        const senderName =
            process.env.EMAIL_FROM_NAME || "Watch Team";

        const senderAddress =
            process.env.EMAIL_FROM_ADDRESS ||
            process.env.SMTP_USER;

        return `"${senderName}" <${senderAddress}>`;
    }

    /**
     * Resolve an email template path safely.
     */
    getTemplatePath(templateName) {
        if (
            !templateName ||
            typeof templateName !== "string" ||
            templateName.includes("..") ||
            templateName.includes("/") ||
            templateName.includes("\\")
        ) {
            throw new Error("Invalid email template name.");
        }

        const templatePath = path.join(
            __dirname,
            "..",
            "email-templates",
            `${templateName}.ejs`
        );

        if (!fs.existsSync(templatePath)) {
            throw new Error(
                `Email template not found: ${templateName}`
            );
        }

        return templatePath;
    }

    /**
     * Render an EJS email template.
     */
    async renderTemplate(templateName, data = {}) {
        const templatePath = this.getTemplatePath(templateName);

        return ejs.renderFile(templatePath, {
            ...data,
            currentYear: new Date().getFullYear(),
            supportEmail:
                process.env.EMAIL_FROM_ADDRESS ||
                "secure@watch-team.com",
            publicBaseUrl:
                process.env.PUBLIC_BASE_URL ||
                "https://watch-team.com",
        });
    }

    /**
     * Send an email using a selected template.
     */
    async send({
        to,
        subject,
        template,
        data = {},
        cc,
        bcc,
        replyTo,
        attachments = [],
        text,
        from,
    }) {
        if (!to) {
            throw new Error("Email recipient is required.");
        }

        if (!subject) {
            throw new Error("Email subject is required.");
        }

        if (!template) {
            throw new Error("Email template is required.");
        }

        const html = await this.renderTemplate(template, data);
        const transporter = this.getTransporter();

        const mailOptions = {
            from: from || this.getDefaultSender(),
            to,
            subject,
            html,
            attachments,
        };

        if (text) {
            mailOptions.text = text;
        }

        if (cc) {
            mailOptions.cc = cc;
        }

        if (bcc) {
            mailOptions.bcc = bcc;
        }

        if (replyTo) {
            mailOptions.replyTo = replyTo;
        }

        try {
            const information = await transporter.sendMail(mailOptions);

            console.log(
                `[EmailService] Email sent to ${to}. Message ID: ${information.messageId}`
            );

            return {
                success: true,
                messageId: information.messageId,
                accepted: information.accepted,
                rejected: information.rejected,
            };
        } catch (error) {
            console.error("[EmailService] Email failed:", {
                recipient: to,
                subject,
                template,
                error: error.message,
            });

            throw error;
        }
    }

    /**
     * Verify the SMTP connection.
     * You can call this once when the server starts.
     */
    async verifyConnection() {
        try {
            const transporter = this.getTransporter();

            await transporter.verify();

            console.log(
                "[EmailService] SMTP connection verified successfully."
            );

            return true;
        } catch (error) {
            console.error(
                "[EmailService] SMTP verification failed:",
                error.message
            );

            return false;
        }
    }

    /**
     * Send a report email.
     */
    async sendReportEmail({
        to,
        recipientName,
        report,
        company,
        postSite,
        submittedBy,
        reportUrl,
        attachments = [],
        cc,
        bcc,
    }) {
        return this.send({
            to,
            cc,
            bcc,
            subject: `New ${report?.category || "Security"} Report - ${
                postSite?.postSiteName ||
                postSite?.name ||
                "Watch Team"
            }`,
            template: "report",
            data: {
                recipientName,
                report,
                company,
                postSite,
                submittedBy,
                reportUrl,
            },
            attachments,
        });
    }

    /**
     * Send a password reset OTP.
     */
    async sendPasswordResetOtp({
        to,
        recipientName,
        otp,
        expiresInMinutes = 10,
    }) {
        return this.send({
            to,
            subject: "Watch Team Password Reset Code",
            template: "password-reset-otp",
            data: {
                recipientName,
                otp,
                expiresInMinutes,
            },
            text:
                `Your Watch Team password reset code is ${otp}. ` +
                `It expires in ${expiresInMinutes} minutes. ` +
                "Do not share this code with anyone.",
        });
    }
}

module.exports = new EmailService();