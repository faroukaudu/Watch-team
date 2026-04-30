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

  // ---- Socket init ----
  const socket = io({
    auth: { userId: String(currentUserId) },
  });

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
    const msgChatId = String(msg.chatId || msg.conversationId || "");
    if (!currentChatId || msgChatId !== String(currentChatId)) return;

    const sender = String(msg.senderId || msg.sender || "");
    const type = sender === String(currentUserId) ? "sent" : "received";

    appendMessage(
      { message: msg.body || msg.message || "", timestamp: msg.createdAt || msg.timestamp || new Date() },
      type
    );
    scrollToBottom();
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

      const tempId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());

      // Optimistic UI (balloon shows immediately)
      appendMessage({ message: text, timestamp: new Date() }, "sent");
      scrollToBottom();
      if (input) input.value = "";

      socket.emit("message:send", { chatId: currentChatId, body: text, tempId }, (ack) => {
        if (!ack?.ok) {
          console.error("Send failed:", ack?.error);
          // Optional: show UI badge "failed"
        }
      });
    } catch (err) {
      console.error("sendMessage error:", err);
    }
  };

  // ---- Balloon UI append (matches your template UL structure) ----
  function appendMessage(msg, type) {
    const chatContainer = document.getElementById("chat-messages");
    if (!chatContainer) {
      console.error("chat-messages element not found");
      return;
    }

    // If chatContainer is a DIV, we'll still append LI; most templates accept it.
    // Prefer UL#chat-messages in your EJS.
    const li = document.createElement("li");
    li.className = type === "sent" ? "chat-item-end" : "chat-item-start";

    const time = (msg.timestamp ? new Date(msg.timestamp) : new Date()).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Keep markup similar to your template (safe text insert below)
    li.innerHTML = `
      <div class="chat-list-inner">
        <div class="ms-3">
          <span class="chatting-user-info">
            <span class="msg-sent-time">${time}</span>
          </span>
          <div class="main-chat-msg">
            <div>
              <p class="mb-0"></p>
            </div>
          </div>
        </div>
      </div>
    `;

    li.querySelector("p").textContent = msg.message || "";

    // ✅ THIS is what makes it show up
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






