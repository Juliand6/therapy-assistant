import "dotenv/config";
import fs from "fs";
import path from "path";

const API_KEY = process.env.BACKBOARD_API_KEY;
const BASE_URL = process.env.BACKBOARD_BASE_URL || "https://app.backboard.io/api";

if (!API_KEY) throw new Error("Missing BACKBOARD_API_KEY in server/.env");

const HEADERS = { "X-API-Key": API_KEY };

// Persist assistant + client thread mapping
const STORE_PATH = path.join(process.cwd(), "backboard_store.json");

function loadStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
  } catch {
    return { assistantId: null, threadsByClient: {}, sessionsByClient: {}, clients: [] };
  }
}

function saveStore(store) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

function recordSession(clientId, sessionObj) {
  store.sessionsByClient ||= {};
  store.sessionsByClient[clientId] ||= [];
  store.sessionsByClient[clientId].push(sessionObj);
  saveStore(store);
}


let store = loadStore();
store.threadsByClient ||= {};
store.sessionsByClient ||= {};
store.clients ||= [];

async function bbPost(url, { json, form } = {}) {
  const opts = { method: "POST", headers: { ...HEADERS } };

  if (json) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(json);
  } else if (form) {
    opts.headers["Content-Type"] = "application/x-www-form-urlencoded";
    opts.body = new URLSearchParams(form).toString();
  }

  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Backboard ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function ensureAssistant() {
  if (store.assistantId) return store.assistantId;

  const a = await bbPost(`${BASE_URL}/assistants`, {
    json: {
      name: "Therapy Notes Assistant",
      description:
        "Therapist-facing documentation + memory assistant. Summarizes transcripts into structured notes and answers therapist questions based on saved notes. Do not diagnose or provide medical advice.",
    },
  });

  store.assistantId = a.assistant_id;
  saveStore(store);

  console.log("[Backboard] assistant_id:", store.assistantId);
  return store.assistantId;
}

async function ensureThreadForClient(clientId) {
  if (!clientId) throw new Error("Missing clientId");

  const assistantId = await ensureAssistant();

  const existing = store.threadsByClient?.[clientId];
  if (existing) return existing;

  const t = await bbPost(`${BASE_URL}/assistants/${assistantId}/threads`, {
    json: {},
  });

  const threadId = t.thread_id;
  store.threadsByClient[clientId] = threadId;
  saveStore(store);

  console.log(`[Backboard] created thread for ${clientId}:`, threadId);
  return threadId;
}

export async function bbResetClient(clientId) {
  if (!clientId) throw new Error("Missing clientId");
  delete store.threadsByClient[clientId];
  saveStore(store);
}

export async function bbResetAll() {
  store = { assistantId: null, threadsByClient: {} };
  saveStore(store);
}

export async function bbSummarizeAndStore({ clientId, transcript, sessionNumber }) {
  const threadId = await ensureThreadForClient(clientId);

  const prompt = `
You are a therapist documentation assistant for licensed clinicians.
Use ONLY the provided transcript. Do not diagnose. Do not provide medical advice.

Output VALID JSON ONLY (no markdown, no commentary) matching this schema:

{
  "summary": ["bullet", "bullet"],
  "themes": ["tag", "tag"],
  "emotions_observed": ["item", "item"],
  "coping_strategies": ["item", "item"],
  "risk_flags": [],
  "therapist_followups": ["bullet", "bullet"],
  "next_session_focus": ["bullet", "bullet"],
  "quotes": ["short quote", "short quote"]
}

Rules:
- If risk is not explicitly present, return "risk_flags": [].
- "quotes" must be short phrases directly from the transcript (optional: 0–3 items).
- Keep lists concise (2–7 items each).

SESSION #: ${sessionNumber ?? 1}
CLIENT: ${clientId}

TRANSCRIPT:
${transcript}
`.trim();

  const resp = await bbPost(`${BASE_URL}/threads/${threadId}/messages`, {
    form: {
      content: prompt,
      stream: "false",
      memory: "Auto",
    },
  });

  const raw = resp?.content ?? "";

  let noteObj;
  try {
    noteObj = JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      const maybeJson = raw.slice(start, end + 1);
      try {
        noteObj = JSON.parse(maybeJson);
      } catch {
        noteObj = { error: "Structured note was not valid JSON", raw };
      }
    } else {
      noteObj = { error: "Structured note was not valid JSON", raw };
    }
  }

  recordSession(clientId, {
    sessionNumber: sessionNumber ?? (store.sessionsByClient?.[clientId]?.length ?? 0) + 1,
    createdAt: new Date().toISOString(),
    note: noteObj,
  });

  const noteAsText =
    noteObj && !noteObj.error ? JSON.stringify(noteObj, null, 2) : String(raw);

  await bbPost(`${BASE_URL}/threads/${threadId}/messages`, {
    form: {
      content: `SESSION NOTE #${sessionNumber ?? 1}\n${noteAsText}`,
      stream: "false",
      memory: "Auto",
    },
  });

 
  return noteObj;
}


export async function bbClientSnapshot(clientId) {
  const threadId = await ensureThreadForClient(clientId);

  const prompt = `
You are a therapist-facing session memory assistant.
Using ONLY information in this client's saved SESSION NOTE messages in this thread,
output VALID JSON ONLY (no markdown, no commentary) matching this schema:

{
  "primary_themes": ["tag", "tag"],
  "progress_since_first": ["bullet", "bullet"],
  "current_challenges": ["bullet", "bullet"],
  "coping_strategies_tried": ["item", "item"],
  "risk_flags": [],
  "suggested_next_focus": ["bullet", "bullet"],
  "confidence": "low" | "medium" | "high"
}

Rules:
- If risk flags are not explicitly mentioned, return "risk_flags": [].
- If there isn’t enough information, keep arrays short and set confidence to "low".
- Do not diagnose. Do not provide medical advice.
`.trim();

  const resp = await bbPost(`${BASE_URL}/threads/${threadId}/messages`, {
    form: {
      content: prompt,
      stream: "false",
      memory: "Auto",
    },
  });

  const raw = resp?.content ?? "";

  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      const maybeJson = raw.slice(start, end + 1);
      try {
        return JSON.parse(maybeJson);
      } catch {
      }
    }

    return {
      error: "Snapshot was not valid JSON",
      raw,
    };
  }
}



export async function bbChat({ clientId, question }) {
  const threadId = await ensureThreadForClient(clientId);

  const prompt = `
You are a therapist-facing memory assistant.
Use ONLY information that exists in saved session notes within this client's thread.
If the answer is not supported, say: "Not enough information in saved sessions."
Always include: "Sessions used: #..." when possible.

CLIENT: ${clientId}
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
export function bbGetSessions(clientId) {
  store.sessionsByClient ||= {};
  return store.sessionsByClient[clientId] || [];
}

function makeClientId() {
  return `client_${Math.random().toString(36).slice(2, 9)}`;
}

export function bbListClients() {
  return store.clients;
}

export function bbCreateClient(name) {
  if (!name || !name.trim()) throw new Error("Client name is required");

  const cleanName = name.trim();

  const exists = store.clients.find(
    (c) => c.name.toLowerCase() === cleanName.toLowerCase()
  );
  if (exists) return exists;

  const client = { id: makeClientId(), name: cleanName, createdAt: new Date().toISOString() };
  store.clients.push(client);
  saveStore(store);


  return client;
}


