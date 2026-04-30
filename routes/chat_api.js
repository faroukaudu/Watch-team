const mongoose = require("mongoose");
const userSchema = require("../db/userdb.js");
const chatSchemaOrModel = require("../db/chatdb.js");
const messageSchema = require("../db/messagedb.js");

const User = mongoose.models.User || mongoose.model("User", userSchema);
const Chat = mongoose.models.Chat || chatSchemaOrModel;
const Message = mongoose.models.Message || mongoose.model("Message", messageSchema);
const { isClientUser, getClientScope } = require("../src/utils/clientScope");
// const Message = mongoose.models.Message || mongoose.model("Message", messageSchema);

// builds a unique key for a direct chat inside a company
function buildDirectKey(companyId, userA, userB) {
  const ids = [String(userA), String(userB)].sort();
  return `${String(companyId)}:${ids[0]}:${ids[1]}`;
}

// optional guard (passport)
async function ensureAuth(req, res, next) {
  try {
    if (req.isAuthenticated && req.isAuthenticated()) {
      return next();
    }

    const mobileUserId = (req.headers["x-user-id"] || "").toString().trim();
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
  // Create/Get direct chat
  app.post("/api/chats/direct", ensureAuth, async (req, res) => {
    try {
      const userId = req.user?._id;
      const otherUserId = req.body?.otherUserId;

      if (!userId) return res.status(401).json({ ok: false, error: "Not logged in" });
      if (!mongoose.isValidObjectId(otherUserId)) {
        return res.status(400).json({ ok: false, error: "Invalid otherUserId" });
      }

      const companyId = String(req.user.assignedCompanyID || "");
      if (!companyId) {
        return res.status(400).json({ ok: false, error: "User has no assignedCompanyID" });
      }

      if (isClientUser(req.user)) {
        const otherUser = await User.findById(otherUserId).select("userType guardPostSite");
        const { assignedPostSiteId } = await getClientScope(req.user);
        const sameSiteGuard = otherUser && otherUser.userType === "AmobileGuard" && Array.isArray(otherUser.guardPostSite) && otherUser.guardPostSite.some((p) => String(p.postSiteID) === String(assignedPostSiteId || ""));
        const superAdmin = otherUser && otherUser.userType === "Super Admin";
        if (!sameSiteGuard && !superAdmin) {
          return res.status(403).json({ ok: false, error: "Unauthorized chat target" });
        }
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
    } catch (e) {
      console.error("POST /api/chats/direct error:", e);
      return res.status(500).json({ ok: false, error: "Server error" });
    }
  });

  // Get messages
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

      if (isClientUser(req.user)) {
        const { assignedPostSiteId } = await getClientScope(req.user);
        const otherIds = (chat.participants || []).map(String).filter((id) => id !== String(req.user._id));
        const otherUser = otherIds.length ? await User.findById(otherIds[0]).select("userType guardPostSite") : null;
        const sameSiteGuard = otherUser && otherUser.userType === "AmobileGuard" && Array.isArray(otherUser.guardPostSite) && otherUser.guardPostSite.some((p) => String(p.postSiteID) === String(assignedPostSiteId || ""));
        const superAdmin = otherUser && otherUser.userType === "Super Admin";
        if (!sameSiteGuard && !superAdmin) {
          return res.status(403).json({ ok: false, error: "Unauthorized" });
        }
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
