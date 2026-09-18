/**
 * Mariala Global Computers — AI chat widget
 * Drop-in, no build step. Add this line before </body> on any page:
 *   <script src="/widget.js"></script>
 *
 * Talks to /api/chat (the serverless function in /api/chat.js), which
 * tries ChatGPT first and falls back to Gemini automatically.
 */
(function () {
  const NAVY = "#0f2340";
  const NAVY_LIGHT = "#16305c";
  const GOLD = "#b8922a";
  const CREAM = "#f4f1ea";

  const style = document.createElement("style");
  style.textContent = `
    #mgc-chat-toggle {
      position: fixed; right: 20px; bottom: 20px; z-index: 999998;
      width: 56px; height: 56px; border-radius: 50%;
      background: ${NAVY}; border: 1.5px solid ${GOLD};
      color: ${GOLD}; font-size: 24px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 16px rgba(0,0,0,0.35);
      transition: transform 0.15s ease;
    }
    #mgc-chat-toggle:hover { transform: scale(1.05); }
    #mgc-chat-panel {
      position: fixed; right: 20px; bottom: 88px; z-index: 999999;
      width: 328px; max-width: calc(100vw - 40px);
      height: 440px; max-height: calc(100vh - 140px);
      background: ${CREAM}; border-radius: 10px;
      border: 1px solid ${NAVY};
      box-shadow: 0 12px 32px rgba(0,0,0,0.4);
      display: none; flex-direction: column; overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    #mgc-chat-panel.open { display: flex; }
    #mgc-chat-header {
      background: ${NAVY}; color: ${CREAM}; padding: 12px 14px;
      display: flex; align-items: center; justify-content: space-between;
      border-bottom: 2px solid ${GOLD};
    }
    #mgc-chat-header strong { font-size: 14px; letter-spacing: 0.2px; }
    #mgc-chat-header span { font-size: 11px; opacity: 0.75; display: block; margin-top: 1px; }
    #mgc-chat-close {
      background: none; border: none; color: ${CREAM}; cursor: pointer;
      font-size: 18px; line-height: 1; padding: 4px;
    }
    #mgc-chat-messages {
      flex: 1; overflow-y: auto; padding: 12px; font-size: 13.5px;
    }
    .mgc-msg { margin-bottom: 10px; line-height: 1.45; max-width: 88%; }
    .mgc-msg.user {
      margin-left: auto; background: ${NAVY}; color: ${CREAM};
      padding: 8px 11px; border-radius: 10px 10px 2px 10px;
    }
    .mgc-msg.bot {
      background: #fff; color: ${NAVY}; border: 1px solid #ddd6c4;
      padding: 8px 11px; border-radius: 10px 10px 10px 2px;
    }
    .mgc-msg.system {
      color: #8a8574; font-size: 12px; text-align: center; margin: 8px 0;
    }
    #mgc-chat-form {
      display: flex; border-top: 1px solid #ddd6c4; padding: 8px;
      gap: 6px; background: #fff;
    }
    #mgc-chat-input {
      flex: 1; border: 1px solid #ccc3a8; border-radius: 6px;
      padding: 8px 10px; font-size: 13.5px; outline: none;
    }
    #mgc-chat-input:focus { border-color: ${GOLD}; }
    #mgc-chat-send {
      background: ${GOLD}; color: ${NAVY}; border: none; border-radius: 6px;
      padding: 0 14px; font-size: 13px; font-weight: 600; cursor: pointer;
    }
    #mgc-chat-send:disabled { opacity: 0.5; cursor: default; }
  `;
  document.head.appendChild(style);

  const toggle = document.createElement("button");
  toggle.id = "mgc-chat-toggle";
  toggle.setAttribute("aria-label", "Open chat");
  toggle.textContent = "💬";
  document.body.appendChild(toggle);

  const panel = document.createElement("div");
  panel.id = "mgc-chat-panel";
  panel.innerHTML = `
    <div id="mgc-chat-header">
      <div>
        <strong>Mariala Global Computers</strong>
        <span>Ask about any of our services</span>
      </div>
      <button id="mgc-chat-close" aria-label="Close chat">✕</button>
    </div>
    <div id="mgc-chat-messages"></div>
    <form id="mgc-chat-form">
      <input id="mgc-chat-input" type="text" placeholder="Type a message…" autocomplete="off" />
      <button id="mgc-chat-send" type="submit">Send</button>
    </form>
  `;
  document.body.appendChild(panel);

  const messagesEl = panel.querySelector("#mgc-chat-messages");
  const formEl = panel.querySelector("#mgc-chat-form");
  const inputEl = panel.querySelector("#mgc-chat-input");
  const sendEl = panel.querySelector("#mgc-chat-send");
  const closeEl = panel.querySelector("#mgc-chat-close");

  let history = [];
  let opened = false;

  function addMessage(role, text) {
    const div = document.createElement("div");
    div.className = "mgc-msg " + role;
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  toggle.addEventListener("click", () => {
    panel.classList.toggle("open");
    if (!opened) {
      opened = true;
      addMessage("system", "Hi 👋 how can we help you today?");
    }
  });
  closeEl.addEventListener("click", () => panel.classList.remove("open"));

  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = inputEl.value.trim();
    if (!message) return;

    addMessage("user", message);
    inputEl.value = "";
    inputEl.disabled = true;
    sendEl.disabled = true;

    const thinking = document.createElement("div");
    thinking.className = "mgc-msg system";
    thinking.textContent = "Typing…";
    messagesEl.appendChild(thinking);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });
      const data = await resp.json();
      thinking.remove();

      if (!resp.ok) {
        addMessage("system", "Sorry, the assistant is unavailable right now. Please reach us on WhatsApp instead.");
      } else {
        addMessage("bot", data.reply);
        history.push({ role: "user", content: message });
        history.push({ role: "assistant", content: data.reply });
        // Keep history from growing unbounded
        if (history.length > 20) history = history.slice(-20);
      }
    } catch (err) {
      thinking.remove();
      addMessage("system", "Connection error. Please try again in a moment.");
    } finally {
      inputEl.disabled = false;
      sendEl.disabled = false;
      inputEl.focus();
    }
  });
})();
