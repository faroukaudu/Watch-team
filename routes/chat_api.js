const mongoose = require("mongoose");
const userSchema = require("../db/userdb.js");
const chatSchemaOrModel = require("../db/chatdb.js");
const messageSchema = require("../db/messagedb.js");

const User = mongoose.models.User || mongoose.model("User", userSchema);
const Chat = mongoose.models.Chat || chatSchemaOrModel;
const Message = mongoose.models.Message || mongoose.model("Message", messageSchema);

const ALLOWED_CHAT_USER_TYPES = ["Super Admin", "Client", "AmobileGuard"];

function buildDirectKey(companyId, userA, userB) {
  const ids = [String(userA), String(userB)].sort();
  return `${String(companyId)}:${ids[0]}:${ids[1]}`;
}

async function ensureAuth(req, res, next) {
  try {
    if (req.isAuthenticated && req.isAuthenticated()) {
      return next();
    }

    const mobileUserId = String(req.headers["x-user-id"] || "").trim();
    if (!mobileUserId) {
      return res.status(401).json({ ok: false, error: "Not logged in" });
    }

    if (!mongoose.isValidObjectId(mobileUserId)) {
      return res.status(400).json({ ok: false, error: "Invalid x-user-id" });
    }

    const mobileUser = await User.findById(mobileUserId);
    if (!mobileUser) {
      return res.status(401).json({ ok: false, error: "Invalid mobile user" });
    }

    req.user = mobileUser;
    return next();
  } catch (err) {
    console.error("ensureAuth error:", err);
    return res.status(500).json({
      ok: false,
      error: "Auth error",
      details: err.message,
    });
  }
}

function registerChatRoutes(app) {
  app.post("/api/chats/direct", ensureAuth, async (req, res) => {
    try {
      const userId = req.user?._id;
      const otherUserId = req.body?.otherUserId;

      if (!userId) {
        return res.status(401).json({ ok: false, error: "Not logged in" });
      }

      if (!mongoose.isValidObjectId(otherUserId)) {
        return res.status(400).json({ ok: false, error: "Invalid otherUserId" });
      }

      if (String(userId) === String(otherUserId)) {
        return res.status(400).json({ ok: false, error: "You cannot open a direct chat with yourself" });
      }

      const companyId = String(req.user.assignedCompanyID || "");
      if (!companyId) {
        return res.status(400).json({ ok: false, error: "User has no assignedCompanyID" });
      }

      const otherUser = await User.findById(otherUserId)
        .select("assignedCompanyID userType status Acc_status");

      if (!otherUser) {
        return res.status(404).json({ ok: false, error: "Chat user not found" });
      }

      if (String(otherUser.assignedCompanyID || "") !== companyId) {
        return res.status(403).json({ ok: false, error: "You can only chat with users in your company" });
      }

      if (!ALLOWED_CHAT_USER_TYPES.includes(otherUser.userType)) {
        return res.status(403).json({ ok: false, error: "This user type is not available in Messenger" });
      }

      const directKey = buildDirectKey(companyId, userId, otherUserId);

      let chat = await Chat.findOne({ companyId, directKey });
      if (!chat) {
        chat = await Chat.create({
          companyId,
          type: "direct",
          participants: [userId, otherUserId],
          directKey,
        });
      }

      return res.json({ ok: true, chatId: String(chat._id) });
    } catch (err) {
      console.error("POST /api/chats/direct error:", err);
      return res.status(500).json({ ok: false, error: "Server error" });
    }
  });

  app.get("/api/messages", ensureAuth, async (req, res) => {
    try {
      const { chatId, limit = 30 } = req.query;

      if (!mongoose.isValidObjectId(chatId)) {
        return res.status(400).json({ ok: false, error: "Invalid chatId" });
      }

      const companyId = String(req.user.assignedCompanyID || "");
      if (!companyId) {
        return res.status(400).json({ ok: false, error: "User has no assignedCompanyID" });
      }

      const chat = await Chat.findOne({ _id: chatId, companyId });
      if (!chat) {
        return res.status(404).json({ ok: false, error: "Chat not found" });
      }

      const isParticipant = (chat.participants || []).some(
        (participantId) => String(participantId) === String(req.user._id)
      );

      if (!isParticipant) {
        return res.status(403).json({ ok: false, error: "You are not a participant in this chat" });
      }

      const msgs = await Message.find({ companyId, chatId })
        .sort({ createdAt: -1 })
        .limit(Math.min(Number(limit) || 30, 200));

      return res.json(msgs);
    } catch (err) {
      console.error("GET /api/messages error:", err);
      return res.status(500).json({ ok: false, error: "Server error" });
    }
  });
}

module.exports = { registerChatRoutes };
