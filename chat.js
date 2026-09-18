// /api/chat.js
// Vercel Serverless Function — chat endpoint with automatic fallback.
// Tries OpenAI (ChatGPT) first. If that call fails or errors for any
// reason, it retries the same conversation against Google Gemini.
//
// Required environment variables (set these in Vercel, not in code):
//   OPENAI_API_KEY   — from platform.openai.com/api-keys
//   GEMINI_API_KEY    — from aistudio.google.com/apikey
//
// Both keys are optional individually (if one is missing, that provider
// is simply skipped), but at least one must be set.

const SYSTEM_PROMPT =
  "You are the assistant for Mariala Global Computers, a Nigerian digital " +
  "services company. You help visitors with questions about the company's " +
  "services: military/paramilitary application assistance, JAMB services, " +
  "NIN solutions, business registration, academic services, graphic " +
  "design, branding, web design, networking, and app development. Be " +
  "concise, friendly, and professional. If you don't know something " +
  "specific about pricing or process, tell the visitor to reach out via " +
  "the WhatsApp or email contact on the site.";

module.exports = async function handler(req, res) {
  // Basic CORS so the widget can call this from the site's front end.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: "Invalid JSON body" });
    }
  }

  const message = (body && body.message || "").toString().trim();
  const history = Array.isArray(body && body.history) ? body.history : [];

  if (!message) {
    return res.status(400).json({ error: "Missing 'message'" });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  // --- Try ChatGPT (OpenAI) first ---
  if (openaiKey) {
    try {
      const reply = await callOpenAI(openaiKey, history, message);
      return res.status(200).json({ reply, provider: "chatgpt" });
    } catch (err) {
      console.error("OpenAI call failed, falling back to Gemini:", err.message);
    }
  }

  // --- Fall back to Gemini ---
  if (geminiKey) {
    try {
      const reply = await callGemini(geminiKey, history, message);
      return res.status(200).json({ reply, provider: "gemini" });
    } catch (err) {
      console.error("Gemini call also failed:", err.message);
    }
  }

  return res.status(502).json({
    error: "Both AI providers failed or are unconfigured. Check your API keys.",
  });
};

async function callOpenAI(apiKey, history, message) {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((h) => ({
      role: h.role === "assistant" ? "assistant" : "user",
      content: String(h.content || ""),
    })),
    { role: "user", content: message },
  ];

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 500,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OpenAI ${resp.status}: ${text}`);
  }

  const data = await resp.json();
  const reply = data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : null;

  if (!reply) throw new Error("OpenAI returned no content");
  return reply;
}

async function callGemini(apiKey, history, message) {
  const contents = [
    ...history.map((h) => ({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: String(h.content || "") }],
    })),
    { role: "user", parts: [{ text: message }] },
  ];

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    "gemini-1.5-flash:generateContent?key=" + apiKey;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: { maxOutputTokens: 500 },
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Gemini ${resp.status}: ${text}`);
  }

  const data = await resp.json();
  const reply =
    data.candidates &&
    data.candidates[0] &&
    data.candidates[0].content &&
    data.candidates[0].content.parts &&
    data.candidates[0].content.parts[0]
      ? data.candidates[0].content.parts[0].text
      : null;

  if (!reply) throw new Error("Gemini returned no content");
  return reply;
}
