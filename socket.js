// socket.js (CommonJS)
// Company is inferred from User.assignedCompanyID (String) — no client spoofing
// Rooms: user:<id>, company:<companyId>, chat:<chatId>

const http = require("http");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

const Chat = require("./db/chatdb.js");
const Message = require("./db/messagedb.js");

const userRoom = (userId) => `user:${userId}`;
const companyRoom = (companyId) => `company:${companyId}`;
const chatRoom = (chatId) => `chat:${chatId}`;

const isOid = (v) => mongoose.isValidObjectId(String(v || ""));

function safeStr(v) {
  return String(v || "").trim();
}

function buildDirectKey(companyId, a, b) {
  const ids = [String(a), String(b)].sort();
  return `${companyId}:${ids[0]}:${ids[1]}`;
}

function incUnreadForOthers(otherUserIds) {
  const inc = {};
  for (const uid of otherUserIds) inc[`unreadCountByUser.${uid}`] = 1;
  return inc;
}

function setUnreadZero(userId) {
  return { [`unreadCountByUser.${userId}`]: 0 };
}

function ensureSameCompany(userCompanyId) {
  if (!userCompanyId) throw new Error("User has no assignedCompanyID");
  return String(userCompanyId);
}

function normalizeAck(ack, payload) {
  if (typeof ack === "function") ack(payload);
}

function normalizeErrAck(ack, err) {
  if (typeof ack === "function") ack({ ok: false, error: err.message || String(err) });
}

function registerSocketLogic(io, User) {
  // AUTH: only accept userId from browser; derive companyId from DB
  io.use(async (socket, next) => {
    try {
      const { userId } = socket.handshake.auth || {};
      
      // ✅ Allow non-chat connections (like guards) to pass through
      if (!userId) return next(); 
      
      if (!isOid(userId)) return next(new Error("Invalid userId"));

      const user = await User.findById(userId).select("_id assignedCompanyID");
      if (!user) return next(new Error("User not found"));

      const companyId = ensureSameCompany(user.assignedCompanyID);

      socket.data.userId = String(user._id);
      socket.data.companyId = companyId;
      socket.data.activeChatId = null;

      next();
    } catch (err) {
      next(err);
    }
  });

  io.on("connection", (socket) => {
    const { userId, companyId } = socket.data;
    
    // ✅ If no userId, this is likely a guard/tracking connection, so skip chat logic
    if (!userId) return;

    socket.join(userRoom(userId));
    socket.join(companyRoom(companyId));

    socket.emit("ready", { userId, companyId });

    // Join chat room (when user opens a chat)
    socket.on("chat:join", async ({ chatId }, ack) => {
      try {
        if (!isOid(chatId)) throw new Error("Invalid chatId");

        const chat = await Chat.findOne({
          _id: chatId,
          companyId,                 // String match
          participants: userId,
        }).select("_id participants companyId");

        if (!chat) throw new Error("Chat not found or access denied");

        if (socket.data.activeChatId && socket.data.activeChatId !== String(chatId)) {
          socket.leave(chatRoom(socket.data.activeChatId));
        }

        socket.join(chatRoom(chatId));
        socket.data.activeChatId = String(chatId);

        normalizeAck(ack, { ok: true });
      } catch (err) {
        normalizeErrAck(ack, err);
      }
    });

    socket.on("chat:leave", ({ chatId }, ack) => {
      try {
        if (chatId && isOid(chatId)) socket.leave(chatRoom(chatId));
        if (socket.data.activeChatId === String(chatId)) socket.data.activeChatId = null;
        normalizeAck(ack, { ok: true });
      } catch (err) {
        normalizeErrAck(ack, err);
      }
    });

    // Send message
    socket.on("message:send", async ({ chatId, body, tempId }, ack) => {
      try {
        if (!isOid(chatId)) throw new Error("Invalid chatId");
        const text = safeStr(body);
        if (!text) throw new Error("Message body is empty");

        const chat = await Chat.findOne({
          _id: chatId,
          companyId,
          participants: userId,
        }).select("_id participants companyId");

        if (!chat) throw new Error("Chat not found or access denied");

        const participants = chat.participants.map((id) => String(id));
        const otherUserIds = participants.filter((id) => id !== String(userId));

        const msg = await Message.create({
          companyId,
          chatId,
          senderId: userId,
          receiverIds: otherUserIds,
          body: text,
          kind: "text",
        });

        const inc = incUnreadForOthers(otherUserIds);

        await Chat.updateOne(
          { _id: chatId },
          {
            $set: { lastMessageId: msg._id, lastMessageAt: msg.createdAt },
            ...(Object.keys(inc).length ? { $inc: inc } : {}),
          }
        );

        const payload = {
          _id: String(msg._id),
          chatId: String(chatId),
          companyId,
          senderId: userId,
          receiverIds: otherUserIds,
          body: msg.body,
          kind: msg.kind,
          createdAt: msg.createdAt,
          tempId: tempId || null,
        };

        io.to(chatRoom(chatId)).emit("message:new", payload);

        // notifications (for chat list badges etc.)
        for (const uid of participants) {
          io.to(userRoom(uid)).emit("message:notify", {
            chatId: String(chatId),
            from: userId,
            messageId: String(msg._id),
            createdAt: msg.createdAt,
          });
        }

        normalizeAck(ack, { ok: true, message: payload });
      } catch (err) {
        normalizeErrAck(ack, err);
      }
    });

    // Mark read
    socket.on("chat:read", async ({ chatId }, ack) => {
      try {
        if (!isOid(chatId)) throw new Error("Invalid chatId");

        const chat = await Chat.findOne({
          _id: chatId,
          companyId,
          participants: userId,
        }).select("_id");

        if (!chat) throw new Error("Chat not found or access denied");

        await Chat.updateOne(
          { _id: chatId },
          { $set: setUnreadZero(userId) }
        );

        io.to(chatRoom(chatId)).emit("chat:readUpdate", {
          chatId: String(chatId),
          userId,
          at: new Date().toISOString(),
        });

        normalizeAck(ack, { ok: true });
      } catch (err) {
        normalizeErrAck(ack, err);
      }
    });

    // Typing
    socket.on("typing", ({ chatId, isTyping }) => {
      if (!isOid(chatId)) return;
      socket.to(chatRoom(chatId)).emit("typing", {
        chatId: String(chatId),
        userId,
        isTyping: !!isTyping,
      });
    });
  });
}

function initSocket(app, User) {
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: {
      origin: true,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  registerSocketLogic(io, User);

  return { io, server };
}

module.exports = { initSocket, registerSocketLogic };