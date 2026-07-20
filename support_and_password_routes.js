
const mongoose = require("mongoose");
const userSchema = require("./db/userdb");
const chatSchemaOrModel = require("./db/chatdb");
const messageSchemaOrModel = require("./db/messagedb");

const User = mongoose.models.User || mongoose.model("User", userSchema);
const Chat = mongoose.models.Chat || chatSchemaOrModel;
const Message = mongoose.models.Message || messageSchemaOrModel;

function buildDirectKey(companyId, userA, userB) {
  const ids = [String(userA), String(userB)].sort();
  return `${String(companyId)}:${ids[0]}:${ids[1]}`;
}

async function mobileUser(req, res, next) {
  try {
    const userId = String(req.headers["x-user-id"] || "").trim();

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(401).json({
        ok: false,
        message: "Invalid mobile user",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(401).json({
        ok: false,
        message: "Mobile user not found",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Mobile support authentication error:", error);
    return res.status(500).json({
      ok: false,
      message: "Authentication error",
    });
  }
}

function registerSupportAndPasswordRoutes(app) {
  app.get("/api/support/admins", mobileUser, async (req, res) => {
    try {
      const companyId = String(req.user.assignedCompanyID || "");

      const admins = await User.find({
        status: true,
        $or: [
          {
            userType: "Super Admin",
            assignedCompanyID: companyId,
          },
          {
            userType: {
              $in: ["Platform Admin", "platform-admin", "platform_admin"],
            },
          },
        ],
      })
        .select("_id fullname email username userType assignedCompanyID")
        .lean();

      const payload = admins.map((admin) => ({
        _id: String(admin._id),
        fullname: admin.fullname || admin.username || "Administrator",
        email: admin.email || admin.username || "",
        role:
          String(admin.userType).toLowerCase().includes("platform")
            ? "Platform Admin"
            : "Super Admin",
      }));

      return res.json({
        ok: true,
        admins: payload,
      });
    } catch (error) {
      console.error("Support admins error:", error);
      return res.status(500).json({
        ok: false,
        message: "Unable to load support administrators",
      });
    }
  });

  app.post("/api/support/messages", mobileUser, async (req, res) => {
    try {
      const { chatId, receiverId, body } = req.body || {};

      if (
        !mongoose.isValidObjectId(chatId) ||
        !mongoose.isValidObjectId(receiverId)
      ) {
        return res.status(400).json({
          ok: false,
          message: "Invalid support conversation",
        });
      }

      const cleanBody = String(body || "").trim();

      if (!cleanBody) {
        return res.status(400).json({
          ok: false,
          message: "Message cannot be empty",
        });
      }

      const companyId = String(req.user.assignedCompanyID || "");
      const chat = await Chat.findOne({
        _id: chatId,
        companyId,
        participants: { $all: [req.user._id, receiverId] },
      });

      if (!chat) {
        return res.status(404).json({
          ok: false,
          message: "Support conversation not found",
        });
      }

      const message = await Message.create({
        companyId,
        chatId,
        senderId: req.user._id,
        receiverIds: [receiverId],
        kind: "text",
        body: cleanBody,
      });

      chat.lastMessageId = message._id;
      chat.lastMessageAt = message.createdAt;
      await chat.save();

      return res.json({
        ok: true,
        message,
      });
    } catch (error) {
      console.error("Support message error:", error);
      return res.status(500).json({
        ok: false,
        message: "Unable to send support message",
      });
    }
  });

  app.post("/api/guard/change-password", mobileUser, async (req, res) => {
    try {
      const oldPassword = String(req.body.oldPassword || "");
      const newPassword = String(req.body.newPassword || "");
      const confirmPassword = String(req.body.confirmPassword || "");

      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          ok: false,
          message: "New passwords do not match",
        });
      }

      if (
        newPassword.length < 8 ||
        !/[A-Z]/.test(newPassword) ||
        !/[a-z]/.test(newPassword) ||
        !/\d/.test(newPassword)
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "Use at least 8 characters with uppercase, lowercase, and a number",
        });
      }

      const authenticated = await new Promise((resolve, reject) => {
        req.user.authenticate(oldPassword, (error, user) => {
          if (error) return reject(error);
          resolve(user || null);
        });
      });

      if (!authenticated) {
        return res.status(400).json({
          ok: false,
          message: "Old password is incorrect",
        });
      }

      await req.user.setPassword(newPassword);
      await req.user.save();

      return res.json({
        ok: true,
        message: "Password changed successfully",
      });
    } catch (error) {
      console.error("Guard change-password error:", error);
      return res.status(500).json({
        ok: false,
        message: "Unable to change password",
      });
    }
  });
}

module.exports = {
  registerSupportAndPasswordRoutes,
};
