const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  companyId: { type: String, required: true, index: true },
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: "Chat", required: true, index: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  receiverIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  kind: { type: String, default: "text" },
  body: { type: String, required: true },
}, { timestamps: true });

messageSchema.index({ chatId: 1, createdAt: -1 });

module.exports = mongoose.models.Message || mongoose.model("Message", messageSchema);
