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

CLIENT: ${clientId}
SESSION #: ${sessionNumber ?? 1}

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

  const note = resp?.content ?? JSON.stringify(resp);

  recordSession(clientId, {
  sessionNumber: sessionNumber ?? (store.sessionsByClient?.[clientId]?.length ?? 0) + 1,
  createdAt: new Date().toISOString(),
  note,
});


  await bbPost(`${BASE_URL}/threads/${threadId}/messages`, {
    form: {
      content: `SESSION NOTE #${sessionNumber ?? 1}\n${note}`,
      stream: "false",
      memory: "Auto",
    },
  });

  return note;
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


