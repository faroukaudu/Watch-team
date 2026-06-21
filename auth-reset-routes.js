const crypto = require('crypto');
const _ = require('lodash');

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resetEmailTemplate({ fullname, code }) {
  return `
  <div style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 12px 30px rgba(15,23,42,.08);">
            <tr>
              <td style="background:linear-gradient(135deg,#0f172a,#2563eb);padding:28px 30px;color:#ffffff;">
                <h1 style="margin:0;font-size:24px;line-height:1.2;">Watch Team Password Reset</h1>
                <p style="margin:10px 0 0;font-size:14px;opacity:.9;">Secure verification code</p>
              </td>
            </tr>
            <tr>
              <td style="padding:30px;">
                <p style="margin:0 0 14px;font-size:16px;">Hello ${fullname || 'there'},</p>
                <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#4b5563;">We received a request to reset your Watch Team account password. Use the 4-digit code below to continue.</p>
                <div style="text-align:center;margin:28px 0;">
                  <div style="display:inline-block;letter-spacing:12px;font-size:36px;font-weight:800;color:#111827;background:#eef4ff;border:1px solid #dbeafe;border-radius:14px;padding:18px 18px 18px 30px;">${code}</div>
                </div>
                <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#6b7280;">This code expires in 10 minutes. If you did not request this reset, you can safely ignore this email.</p>
                <p style="margin:24px 0 0;font-size:14px;color:#111827;">— Watch Team Security</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>`;
}

function registerAuthResetRoutes(app, User, emailSent) {
  const allowedUserTypes = ['Client', 'Super Admin', 'Platform Admin'];

  function setResetModal(req, type, title, message) {
    req.session.resetModal = { type, title, message };
  }

  function getResetModal(req) {
    const modal = req.session.resetModal || null;
    delete req.session.resetModal;
    return modal;
  }

  app.get('/email-reset', (req, res) => {
    res.render('auth/email-reset', { resetModal: getResetModal(req), email: req.session.resetEmail || '' });
  });

  app.post('/email-reset', async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();

    if (!email) {
      setResetModal(req, 'danger', 'Email Required', 'Please enter your registered email address.');
      return res.redirect('/email-reset');
    }

    try {
      const emailRegex = new RegExp(`^${escapeRegExp(email)}$`, 'i');
      const user = await User.findOne({ $or: [{ email: emailRegex }, { username: emailRegex }] });

      if (!user) {
        setResetModal(req, 'danger', 'User Not Found', 'No account was found with that email address.');
        return res.redirect('/email-reset');
      }

      if (!allowedUserTypes.includes(user.userType)) {
        setResetModal(req, 'danger', 'Not Authorized', 'This user is not authorized to reset password on this platform.');
        return res.redirect('/email-reset');
      }

      const code = crypto.randomInt(1000, 10000).toString();
      user.passwordResetCode = code;
      user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000);
      user.passwordResetVerified = false;
      await user.save();

      req.session.resetUserId = String(user._id);
      req.session.resetEmail = user.email || user.username || email;

      await emailSent({
        sendTo: user.email || user.username,
        title: 'Watch Team Password Reset Code',
        message: `Your Watch Team password reset code is ${code}. It expires in 10 minutes.`,
        template: resetEmailTemplate({ fullname: user.fullname, code }),
        emailType: 'password-reset',
      });

      setResetModal(req, 'success', 'Code Sent', 'A 4-digit password reset code has been sent to your email.');
      return res.redirect('/2fa');
    } catch (err) {
      console.error('Password reset email error:', err);
      setResetModal(req, 'danger', 'Reset Error', 'Something went wrong while sending the reset code. Please try again.');
      return res.redirect('/email-reset');
    }
  });

  app.get('/2fa', (req, res) => {
    if (!req.session.resetUserId) {
      setResetModal(req, 'warning', 'Start Again', 'Please enter your email before verifying your code.');
      return res.redirect('/email-reset');
    }

    res.render('auth/2fa', { resetModal: getResetModal(req), email: req.session.resetEmail || '' });
  });

  app.post('/2fa', async (req, res) => {
    const userId = req.session.resetUserId;
    const code = `${req.body.one || ''}${req.body.two || ''}${req.body.three || ''}${req.body.four || ''}`.replace(/\D/g, '');

    if (!userId) {
      setResetModal(req, 'warning', 'Start Again', 'Please enter your email before verifying your code.');
      return res.redirect('/email-reset');
    }

    if (code.length !== 4) {
      setResetModal(req, 'danger', 'Invalid Code', 'Please enter the complete 4-digit code.');
      return res.redirect('/2fa');
    }

    try {
      const user = await User.findOne({
        _id: userId,
        passwordResetCode: code,
        passwordResetExpires: { $gt: new Date() },
      });

      if (!user) {
        setResetModal(req, 'danger', 'Code Not Accepted', 'The code is incorrect or has expired.');
        return res.redirect('/2fa');
      }

      user.passwordResetVerified = true;
      await user.save();

      setResetModal(req, 'success', 'Code Accepted', 'Your verification code has been accepted. Please create a new password.');
      return res.redirect('/reset-password');
    } catch (err) {
      console.error('Password reset code error:', err);
      setResetModal(req, 'danger', 'Verification Error', 'Something went wrong while verifying your code.');
      return res.redirect('/2fa');
    }
  });

  app.get('/reset-password', async (req, res) => {
    if (!req.session.resetUserId) {
      setResetModal(req, 'warning', 'Start Again', 'Please enter your email before resetting your password.');
      return res.redirect('/email-reset');
    }

    const user = await User.findById(req.session.resetUserId);
    if (!user || !user.passwordResetVerified) {
      setResetModal(req, 'warning', 'Verify Code First', 'Please verify your 4-digit code before resetting your password.');
      return res.redirect('/2fa');
    }

    res.render('auth/reset-password', { resetModal: getResetModal(req), email: req.session.resetEmail || '', fullname: user.fullname || 'User' });
  });

  app.post('/reset-password', async (req, res) => {
    const { password, confirmPassword } = req.body;
    const userId = req.session.resetUserId;

    if (!userId) {
      setResetModal(req, 'warning', 'Start Again', 'Please enter your email before resetting your password.');
      return res.redirect('/email-reset');
    }

    if (!password || password.length < 6) {
      setResetModal(req, 'danger', 'Weak Password', 'Password must be at least 6 characters long.');
      return res.redirect('/reset-password');
    }

    if (password !== confirmPassword) {
      setResetModal(req, 'danger', 'Password Mismatch', 'New password and confirm password do not match.');
      return res.redirect('/reset-password');
    }

    try {
      const user = await User.findOne({
        _id: userId,
        passwordResetVerified: true,
        passwordResetExpires: { $gt: new Date() },
      });

      if (!user) {
        setResetModal(req, 'danger', 'Reset Expired', 'Your reset session has expired. Please request a new code.');
        return res.redirect('/email-reset');
      }

      await user.setPassword(password);
      user.passwordResetCode = undefined;
      user.passwordResetExpires = undefined;
      user.passwordResetVerified = false;
      await user.save();
      req.session.resetModal = {
    title: "Password Reset Successful",
    message: "Your password has been changed successfully. Please sign in with your new password."
};

      delete req.session.resetUserId;
      delete req.session.resetEmail;

      req.session.webLoginError = null;
      req.session.resetModal = { type: 'success', title: 'Password Changed', message: 'Your password has been changed successfully. Please login with your new password.' };
      return res.redirect('/sign-in');
    } catch (err) {
      console.error('Password change error:', err);
      setResetModal(req, 'danger', 'Password Error', 'Something went wrong while changing your password.');
      return res.redirect('/reset-password');
    }
  });
}

module.exports = { registerAuthResetRoutes };
