import "dotenv/config";

const API_KEY = process.env.BACKBOARD_API_KEY;
const BASE_URL = process.env.BACKBOARD_BASE_URL || "https://app.backboard.io/api";

if (!API_KEY) throw new Error("Missing BACKBOARD_API_KEY in server/.env");

const HEADERS = {
  "X-API-Key": API_KEY,
};

let assistantId = null;
let threadId = null;

// ---------- internal helpers ----------
async function bbPost(url, { json, form } = {}) {
  const opts = { method: "POST", headers: { ...HEADERS } };

  if (json) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(json);
  } else if (form) {
    // Backboard quickstart uses form-style "data"
    opts.headers["Content-Type"] = "application/x-www-form-urlencoded";
    opts.body = new URLSearchParams(form).toString();
  }

  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Backboard ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function ensureAssistantAndThread() {
  if (assistantId && threadId) return { assistantId, threadId };

  // 1) Create assistant
  const a = await bbPost(`${BASE_URL}/assistants`, {
    json: {
      name: "Therapy Notes Assistant",
      description:
        "Therapist-facing documentation + memory assistant. Summarizes transcripts into structured notes and answers therapist questions based on past saved notes. Do not diagnose or provide medical advice.",
    },
  });
  assistantId = a.assistant_id;

  // 2) Create thread
  const t = await bbPost(`${BASE_URL}/assistants/${assistantId}/threads`, {
    json: {},
  });
  threadId = t.thread_id;

  console.log("[Backboard] assistant_id:", assistantId);
  console.log("[Backboard] thread_id:", threadId);

  return { assistantId, threadId };
}

// ---------- exported functions ----------
export async function bbSummarizeAndStore({ transcript, sessionNumber }) {
  await ensureAssistantAndThread();

  const prompt = `
You are a therapist documentation assistant for licensed clinicians.
You do NOT diagnose. You do NOT provide medical advice.
You only summarize and organize the provided transcript.

Create a structured session note with:
- Summary (5–7 bullets)
- Themes (3–8 tags)
- Emotions observed (list)
- Coping strategies mentioned (list)
- Risk flags (only if explicitly present; else "none noted")
- Therapist follow-ups (3–6 bullets)
- Next session focus (1–3 bullets)

Return plain text.

SESSION #: ${sessionNumber ?? 1}

TRANSCRIPT:
${transcript}
`.trim();

  // 3) Send message (memory Auto)
  const resp = await bbPost(`${BASE_URL}/threads/${threadId}/messages`, {
    form: {
      content: prompt,
      stream: "false",
      memory: "Auto",
    },
  });

  // Quickstart shows response.json().get("content")
  // so we return resp.content
  const note = resp?.content ?? JSON.stringify(resp);

  // Optional: store a clean “SESSION NOTE #n …” message too (improves retrieval)
  await bbPost(`${BASE_URL}/threads/${threadId}/messages`, {
    form: {
      content: `SESSION NOTE #${sessionNumber ?? 1}\n${note}`,
      stream: "false",
      memory: "Auto",
    },
  });

  return note;
}

export async function bbChat({ question }) {
  await ensureAssistantAndThread();

  const prompt = `
You are a therapist-facing memory assistant.
Use ONLY information that exists in saved session notes within this thread.
If the answer is not supported, say: "Not enough information in saved sessions."
Always include: "Sessions used: #..." (infer session numbers from the notes when possible).

Question:
${question}
`.trim();

  const resp = await bbPost(`${BASE_URL}/threads/${threadId}/messages`, {
    form: {
      content: prompt,
      stream: "false",
      memory: "Auto",
    },
  });

  return resp?.content ?? JSON.stringify(resp);
}
