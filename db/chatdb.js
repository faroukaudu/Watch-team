// models/Chat.js
const mongoose = require("mongoose");
mongoose.set("strictQuery", true);

const { Schema } = mongoose;

const chatSchema = new Schema(
  {
    // MUST match User.assignedCompanyID (String)
    companyId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    type: {
      type: String,
      enum: ["direct", "group"],
      default: "direct",
      index: true,
    },

    // store user _id(s) here (ObjectId)
    // IMPORTANT: change ref to your real User model name if different
    participants: [
      { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    ],

    // For 1:1 chats: prevents duplicates inside same company
    // companyId + ":" + [userA,userB].sort().join(":")
    directKey: { type: String, unique: true, sparse: true, index: true },

    // group chat only (optional)
    title: { type: String, trim: true },

    lastMessageId: { type: Schema.Types.ObjectId, ref: "Message" },
    lastMessageAt: { type: Date, index: true },

    // unreadCountByUser["<userId>"] = number
    // stored as a map so you can do $inc / $set by userId
    unreadCountByUser: { type: Map, of: Number, default: {} },
  },
  { timestamps: true }
);

// helpful index for chat list screen
chatSchema.index({ companyId: 1, lastMessageAt: -1 });

module.exports = mongoose.models.Chat || mongoose.model("Chat", chatSchema);