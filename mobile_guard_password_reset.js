const crypto = require("crypto");
const { emailSent } = require("./nodemailer");

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function hashValue(value) {
  return crypto
    .createHash("sha256")
    .update(String(value))
    .digest("hex");
}

function publicGuardAccount(user) {
  return {
    userId: String(user._id),
    fullname: user.fullname || user.username || "Guard Account",
    companyName: user.compName || "",
    assignedCompanyID: user.assignedCompanyID || "",
    postSites: Array.isArray(user.guardPostSite) ? user.guardPostSite : [],
  };
}

function passwordStrengthError(password) {
  const value = String(password || "");

  if (value.length < 8) {
    return "Password must be at least 8 characters long.";
  }

  if (!/[a-z]/.test(value)) {
    return "Password must contain at least one lowercase letter.";
  }

  if (!/[A-Z]/.test(value)) {
    return "Password must contain at least one uppercase letter.";
  }

  if (!/\d/.test(value)) {
    return "Password must contain at least one number.";
  }

  return null;
}

function otpEmailTemplate({ fullname, otp }) {
  return `
    <div style="margin:0;padding:0;background:#f3f5f9;font-family:Arial,Helvetica,sans-serif;color:#111827;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
              style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e5e7eb;">
              <tr>
                <td style="background:#0f3dff;padding:26px 30px;color:#ffffff;">
                  <h1 style="margin:0;font-size:23px;">Watch Team Password Reset</h1>
                  <p style="margin:8px 0 0;font-size:14px;opacity:.9;">Guard account verification</p>
                </td>
              </tr>

              <tr>
                <td style="padding:30px;">
                  <p style="margin:0 0 14px;font-size:16px;">
                    Hello ${fullname || "Guard"},
                  </p>

                  <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#4b5563;">
                    Enter this one-time password in the Watch Team mobile app to continue resetting your password.
                  </p>

                  <div style="text-align:center;margin:28px 0;">
                    <div style="display:inline-block;letter-spacing:10px;font-size:34px;font-weight:800;
                      color:#111827;background:#eef2ff;border:1px solid #c7d2fe;border-radius:14px;
                      padding:18px 18px 18px 28px;">
                      ${otp}
                    </div>
                  </div>

                  <p style="margin:0;font-size:14px;line-height:1.6;color:#6b7280;">
                    This OTP expires in 10 minutes. Do not share it with anyone. If you did not request this reset,
                    you can safely ignore this email.
                  </p>
                </td>
              </tr>

              <tr>
                <td style="background:#111827;color:#ffffff;padding:14px 30px;font-size:12px;">
                  Watch Team Security
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

function registerMobileGuardPasswordResetRoutes(app, User) {
  /**
   * Step 1:
   * Check the guard email and send an OTP.
   *
   * When more than one guard uses the same email, the first request returns
   * account choices. The app then repeats the request with userId.
   */
  app.post("/guard-password-reset/request", async (req, res) => {
    try {
      const email = normalizeEmail(req.body.email);
      const selectedUserId = String(req.body.userId || "").trim();

      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email address is required.",
        });
      }

      const emailRegex = new RegExp(`^${escapeRegExp(email)}$`, "i");

      const matches = await User.find({
        userType: "AmobileGuard",
        $or: [
          { email: emailRegex },
          { username: emailRegex },
        ],
      });

      if (matches.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No registered guard account was found with this email.",
        });
      }

      let guard = null;

      if (selectedUserId) {
        guard = matches.find(
          (item) => String(item._id) === selectedUserId
        );

        if (!guard) {
          return res.status(403).json({
            success: false,
            message: "The selected guard account does not match this email.",
          });
        }
      } else if (matches.length > 1) {
        return res.status(200).json({
          success: true,
          requiresAccountSelection: true,
          message: "Multiple guard accounts use this email. Select your account.",
          accounts: matches.map(publicGuardAccount),
        });
      } else {
        guard = matches[0];
      }

      if (!guard.status) {
        return res.status(403).json({
          success: false,
          message: "This guard account is inactive. Contact your administrator.",
        });
      }

      const otp = crypto.randomInt(100000, 1000000).toString();

      guard.mobilePasswordResetOtpHash = hashValue(otp);
      guard.mobilePasswordResetExpires = new Date(
        Date.now() + 10 * 60 * 1000
      );
      guard.mobilePasswordResetVerified = false;
      guard.mobilePasswordResetTokenHash = undefined;

      await guard.save();

      await emailSent({
        sendTo: guard.email || guard.username,
        title: "Watch Team Guard Password Reset OTP",
        message: `Your Watch Team password reset OTP is ${otp}. It expires in 10 minutes.`,
        template: otpEmailTemplate({
          fullname: guard.fullname,
          otp,
        }),
        emailType: "guard-password-reset",
      });

      return res.status(200).json({
        success: true,
        requiresAccountSelection: false,
        message: "A 6-digit OTP has been sent to your email.",
        userId: String(guard._id),
        maskedEmail: email.replace(
          /^(.{1,2})(.*)(@.*)$/,
          (_, start, middle, domain) =>
            `${start}${"*".repeat(Math.min(middle.length, 6))}${domain}`
        ),
      });
    } catch (error) {
      console.error("Guard password-reset request error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to send the OTP. Please try again.",
      });
    }
  });

  /**
   * Step 2:
   * Verify the OTP and issue a short-lived reset token.
   */
  app.post("/guard-password-reset/verify", async (req, res) => {
    try {
      const userId = String(req.body.userId || "").trim();
      const otp = String(req.body.otp || "").replace(/\D/g, "");

      if (!userId || otp.length !== 6) {
        return res.status(400).json({
          success: false,
          message: "Enter the complete 6-digit OTP.",
        });
      }

      const guard = await User.findOne({
        _id: userId,
        userType: "AmobileGuard",
        mobilePasswordResetOtpHash: hashValue(otp),
        mobilePasswordResetExpires: { $gt: new Date() },
      });

      if (!guard) {
        return res.status(400).json({
          success: false,
          message: "The OTP is incorrect or has expired.",
        });
      }

      const resetToken = crypto.randomBytes(32).toString("hex");

      guard.mobilePasswordResetVerified = true;
      guard.mobilePasswordResetTokenHash = hashValue(resetToken);
      guard.mobilePasswordResetExpires = new Date(
        Date.now() + 15 * 60 * 1000
      );

      await guard.save();

      return res.status(200).json({
        success: true,
        message: "OTP verified successfully.",
        resetToken,
      });
    } catch (error) {
      console.error("Guard OTP verification error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to verify the OTP. Please try again.",
      });
    }
  });

  /**
   * Step 3:
   * Reset the Passport-local password.
   */
  app.post("/guard-password-reset/complete", async (req, res) => {
    try {
      const userId = String(req.body.userId || "").trim();
      const resetToken = String(req.body.resetToken || "");
      const password = String(req.body.password || "");
      const confirmPassword = String(req.body.confirmPassword || "");

      if (!userId || !resetToken) {
        return res.status(400).json({
          success: false,
          message: "Your password-reset session is invalid.",
        });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: "New password and confirm password do not match.",
        });
      }

      const strengthError = passwordStrengthError(password);

      if (strengthError) {
        return res.status(400).json({
          success: false,
          message: strengthError,
        });
      }

      const guard = await User.findOne({
        _id: userId,
        userType: "AmobileGuard",
        mobilePasswordResetVerified: true,
        mobilePasswordResetTokenHash: hashValue(resetToken),
        mobilePasswordResetExpires: { $gt: new Date() },
      });

      if (!guard) {
        return res.status(400).json({
          success: false,
          message: "Your password-reset session has expired. Request a new OTP.",
        });
      }

      await guard.setPassword(password);

      guard.mobilePasswordResetOtpHash = undefined;
      guard.mobilePasswordResetExpires = undefined;
      guard.mobilePasswordResetVerified = false;
      guard.mobilePasswordResetTokenHash = undefined;

      await guard.save();

      return res.status(200).json({
        success: true,
        message: "Your password has been changed successfully.",
      });
    } catch (error) {
      console.error("Guard password-reset completion error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to change the password. Please try again.",
      });
    }
  });
}

module.exports = {
  registerMobileGuardPasswordResetRoutes,
};
