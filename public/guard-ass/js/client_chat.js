// public/js/client_chat.js
// Requires EJS to define window.CHAT_CONTEXT before this script runs:
// <script>window.CHAT_CONTEXT={ userId:"...", companyId:"..." };</script>

(() => {
  // ---- Context / Guards ----
  const ctx = window.CHAT_CONTEXT || {};
  const currentUserId = ctx.userId || window.currentUserId || window.currentUserID;
  const companyId = ctx.companyId || window.companyId;

  if (!currentUserId) {
    console.error("CHAT_CONTEXT.userId (currentUserId) is missing. Add it in EJS before loading this file.");
  }

  // ---- Audio ----
  // NOTE: Create a /public/sounds/ folder and place your audio files there.
  const receiveSound = new Audio("/sounds/message-received.mp3");
  const sendSound = new Audio("/sounds/message-sent.mp3");

  // ---- Socket init ----
  const socket = io({
    auth: { userId: String(currentUserId) },
  });

  // For SOunds
  let soundEnabled = false;

function enableSoundsOnce() {
  soundEnabled = true;

  // Prime audio (helps on iOS/Android)
  const a1 = document.getElementById("snd-sent");
  const a2 = document.getElementById("snd-incoming");
  [a1, a2].forEach(a => {
    if (!a) return;
    a.volume = 0.7;
    a.play().then(() => { a.pause(); a.currentTime = 0; }).catch(() => {});
  });

  document.removeEventListener("click", enableSoundsOnce);
  document.removeEventListener("touchstart", enableSoundsOnce);
}

document.addEventListener("click", enableSoundsOnce, { once: true });
document.addEventListener("touchstart", enableSoundsOnce, { once: true });

function playSound(id) {
  if (!soundEnabled) return;
  const a = document.getElementById(id);
  if (!a) return;
  a.currentTime = 0;
  a.play().catch(() => {});
}

  const pendingTempIds = new Set();
const seenMessageIds = new Set();

  let currentChatId = null;        // active chat thread ID
  let currentChatPartnerId = null; // selected user id

  socket.on("connect", () => {
    // console.log("socket connected:", socket.id);
  });

  socket.on("connect_error", (err) => {
    console.error("socket connect_error:", err?.message || err);
  });

  socket.on("ready", () => {
    // connected / authorized
  });

  // Realtime incoming message
  socket.on("message:new", (msg) => {
  if (String(msg.chatId) !== String(currentChatId)) return;

  // ✅ Prevent duplicates by message id
  if (msg._id && seenMessageIds.has(String(msg._id))) return;
  if (msg._id) seenMessageIds.add(String(msg._id));

  // ✅ If this is the server echo of OUR optimistic message, update the existing bubble
  if (msg.tempId && pendingTempIds.has(String(msg.tempId))) {
    pendingTempIds.delete(String(msg.tempId));

    // Find the pending bubble and update its timestamp (and optionally store real id)
    const el = document.querySelector(`[data-temp-id="${msg.tempId}"]`);
    if (el) {
      const timeEl = el.querySelector(".meta");
      if (timeEl) {
        const ts = msg.createdAt ? new Date(msg.createdAt) : new Date();
        timeEl.textContent = ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }
      el.setAttribute("data-msg-id", String(msg._id || ""));
    }
    return; // ✅ don't append again
  }

  // Otherwise append normally (incoming message or history)
  const sender = String(msg.senderId || "");
  const type = sender === String(currentUserId) ? "sent" : "received";

  // Play sound for incoming messages
  // if (type === "received") {
  //   receiveSound.play().catch(e => console.error("Error playing receive sound:", e));
  // }

  appendMessage({ message: msg.body, timestamp: msg.createdAt }, type);
  scrollToBottom();
  
  if (type === "received") playSound("snd-incoming");
});

  // Optional typing indicator listener
  socket.on("typing", ({ chatId, conversationId, userId, isTyping }) => {
    const cid = String(chatId || conversationId || "");
    if (!currentChatId || cid !== String(currentChatId)) return;
    // You can show typing UI here
  });

  // ---- Public functions used by EJS onclick handlers ----
  window.selectUser = async function selectUser(userId, userName) {
    try {
      currentChatPartnerId = String(userId);

      // Update header text (right side)
      const header = document.getElementById("chat-header-name");
      if (header) header.innerText = userName || "Chat";

      // Optional: update header avatar letter if present
      const headerLetter = document.getElementById("chat-header-letter");
      if (headerLetter) {
        const letter = (userName || "?").trim().charAt(0).toUpperCase() || "?";
        headerLetter.textContent = letter;
      }

      // Clear messages UI
      const list = document.getElementById("chat-messages");
      if (list) list.innerHTML = "";

      // Hide empty hint if exists
      const hint = document.getElementById("chat-empty-hint");
      if (hint) hint.style.display = "none";

      // 1) Get or create a direct chat
      const r = await fetch("/api/chats/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otherUserId: currentChatPartnerId }),
      });

      if (!r.ok) {
        const t = await r.text();
        console.error("POST /api/chats/direct failed:", r.status, t);
        alert("Chat could not be opened. Check /api/chats/direct route.");
        return;
      }

      const data = await r.json();
      if (!data.chatId) {
        console.error("No chatId returned:", data);
        alert("Chat create failed: no chatId returned.");
        return;
      }

      currentChatId = String(data.chatId);

      // 2) Join this chat room
      socket.emit("chat:join", { chatId: currentChatId }, (ack) => {
        if (!ack?.ok) console.error("chat:join failed:", ack?.error);
      });

      // 3) Fetch recent messages
      const res = await fetch(`/api/messages?chatId=${encodeURIComponent(currentChatId)}&limit=50`);
      if (!res.ok) {
        const t = await res.text();
        console.error("GET /api/messages failed:", res.status, t);
        // Not fatal: still allow sending
        scrollToBottom();
        return;
      }

      const messages = await res.json();

      // If API returns newest first, reverse to render oldest->newest
      if (Array.isArray(messages)) {
        messages.reverse().forEach((m) => {
          const sender = String(m.senderId || m.sender || "");
          const type = sender === String(currentUserId) ? "sent" : "received";
          appendMessage({ message: m.body || m.message || "", timestamp: m.createdAt || m.timestamp }, type);
        });
      }

      scrollToBottom();

      // Mark chat as read (optional)
      socket.emit("chat:read", { chatId: currentChatId });
    } catch (err) {
      console.error("selectUser error:", err);
    }
  };

  window.sendMessage = function sendMessage() {
    try {
      const input = document.getElementById("message-input");
      const text = (input?.value || "").trim();

      if (!currentChatId) {
        alert("Select a user first.");
        return;
      }
      if (!text) return;

      // Play send sound
      sendSound.play().catch(e => console.error("Error playing send sound:", e));

      const tempId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
pendingTempIds.add(tempId);

// optimistic UI (mark bubble with tempId)
appendMessage({ message: text, timestamp: new Date(), tempId }, "sent");
scrollToBottom();
playSound("snd-sent");



input.value = "";

socket.emit("message:send", { chatId: currentChatId, body: text, tempId }, (ack) => {
  if (!ack?.ok) console.error("Send failed:", ack?.error);
});
    } catch (err) {
      console.error("sendMessage error:", err);
    }
  };

  // ---- Balloon UI append (matches your template UL structure) ----
function appendMessage(msg, type) {
  const chatContainer = document.getElementById("chat-messages");
  if (!chatContainer) return;

  const li = document.createElement("li");
  li.className = `msg-row ${type}`;

  if (msg.tempId) li.setAttribute("data-temp-id", String(msg.tempId));
  if (msg._id) li.setAttribute("data-msg-id", String(msg._id));

  // Bubble
  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const p = document.createElement("p");
  p.className = "text";
  p.textContent = msg.message || "";

  bubble.appendChild(p);

  // Time OUTSIDE bubble
  const meta = document.createElement("div");
  meta.className = "meta-out";

  const ts = msg.timestamp ? new Date(msg.timestamp) : new Date();
  meta.textContent = ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  li.appendChild(bubble);
  li.appendChild(meta);
  chatContainer.appendChild(li);
}

  function scrollToBottom() {
    // Try scrolling the main chat body wrapper if present
    const wrap = document.querySelector(".chat-body");
    if (wrap) {
      wrap.scrollTop = wrap.scrollHeight;
      return;
    }
    // fallback: scroll messages container
    const chatContainer = document.getElementById("chat-messages");
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }

  // ---- UX: Send on Enter ----
  document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("message-input");
    if (!input) return;

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        window.sendMessage();
      }
    });
  });
})();
