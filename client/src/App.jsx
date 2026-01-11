import { useEffect, useMemo, useState } from "react";

const API_BASE = "http://localhost:8080";

export default function App() {
  // Clients (loaded from server)
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);

  // Add session
  const [transcript, setTranscript] = useState("");
  const [sessionNumber, setSessionNumber] = useState(1);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Past sessions (per client)
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Chat
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);

  const clientName = useMemo(
    () => clients.find((c) => c.id === clientId)?.name ?? clientId,
    [clients, clientId]
  );

  async function fetchClients() {
    const res = await fetch(`${API_BASE}/api/clients`);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Failed to load clients");

    setClients(data.clients || []);

    // If no client selected yet, pick the first
    if (!clientId && data.clients?.length) {
      setClientId(data.clients[0].id);
    }
  }

  async function fetchSessions(forClientId) {
    if (!forClientId) return;

    setLoadingSessions(true);
    try {
      const res = await fetch(`${API_BASE}/api/clients/${forClientId}/sessions`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load sessions");

      setSessions(data.sessions || []);
      setSessionNumber((data.sessions?.length ?? 0) + 1);
    } catch (err) {
      setSessions([]);
      console.error(err);
    } finally {
      setLoadingSessions(false);
    }
  }

  useEffect(() => {
    fetchClients().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // when switching clients, clear UI + load that client’s sessions
    setNote("");
    setAnswer("");
    setQuestion("");
    setTranscript("");
    fetchSessions(clientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function createClient() {
    const name = newClientName.trim();
    if (!name) return;

    setCreatingClient(true);
    try {
      const res = await fetch(`${API_BASE}/api/clients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create client");

      // refresh client list, then select the new one
      await fetchClients();
      setClientId(data.client.id);

      setNewClientName("");
    } catch (err) {
      alert(err.message);
    } finally {
      setCreatingClient(false);
    }
  }

  async function generateAndSave() {
    if (!clientId) return;

    setSaving(true);
    setNote("");

    try {
      const res = await fetch(`${API_BASE}/api/add-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          transcript,
          sessionNumber,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Request failed");

      setNote(data.note);
      await fetchSessions(clientId);
    } catch (err) {
      setNote(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function ask() {
    if (!clientId) return;

    setAsking(true);
    setAnswer("");

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          question,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Request failed");

      setAnswer(data.answer);
    } catch (err) {
      setAnswer(`Error: ${err.message}`);
    } finally {
      setAsking(false);
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: "40px auto", fontFamily: "system-ui" }}>
      <h1 style={{ marginBottom: 6 }}>Therapy Assistant (MVP)</h1>
      <p style={{ marginTop: 0, color: "#555" }}>
        Therapist-only demo. Each client has isolated memory (one Backboard thread per client).
      </p>

      {/* Client selector + create client */}
      <div style={{ display: "flex", gap: 18, alignItems: "flex-end", margin: "18px 0" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, color: "#666" }}>Select client</span>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            style={{ padding: 8, minWidth: 220 }}
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, color: "#666" }}>Add new client</span>
            <input
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              placeholder="e.g., Sam"
              style={{ padding: 8, minWidth: 220 }}
            />
          </label>

          <button onClick={createClient} disabled={creatingClient || !newClientName.trim()}>
            {creatingClient ? "Adding..." : "Add"}
          </button>
        </div>

        <div style={{ color: "#666", fontSize: 14, marginLeft: "auto" }}>
          Viewing: <b>{clientName || "—"}</b>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 18, alignItems: "start" }}>
        {/* LEFT: Past sessions */}
        <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ marginTop: 0 }}>Past Sessions</h2>
            <button onClick={() => fetchSessions(clientId)} disabled={loadingSessions || !clientId}>
              {loadingSessions ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {!clientId ? (
            <p style={{ color: "#666" }}>Create or select a client to view sessions.</p>
          ) : loadingSessions ? (
            <p style={{ color: "#666" }}>Loading sessions…</p>
          ) : sessions.length === 0 ? (
            <p style={{ color: "#666" }}>No sessions saved for this client yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {sessions
                .slice()
                .reverse()
                .map((s, idx) => (
                  <div
                    key={`${s.sessionNumber}-${idx}`}
                    style={{ border: "1px solid #eee", borderRadius: 8, padding: 10, background: "#fafafa" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <b>Session #{s.sessionNumber}</b>
                      <span style={{ color: "#777", fontSize: 12 }}>
                        {s.createdAt ? new Date(s.createdAt).toLocaleString() : ""}
                      </span>
                    </div>
                    <pre style={{ margin: "8px 0 0", whiteSpace: "pre-wrap" }}>
                      {typeof s.note === "string" ? s.note : JSON.stringify(s.note)}
                    </pre>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* RIGHT: Add session + chat */}
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 14 }}>
            <h2 style={{ marginTop: 0 }}>Add Session</h2>

            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "#666" }}>Session #</span>
                <input
                  type="number"
                  min={1}
                  value={sessionNumber}
                  onChange={(e) => setSessionNumber(Number(e.target.value))}
                  style={{ width: 110, padding: 8 }}
                  disabled={!clientId}
                />
              </label>
              <span style={{ color: "#777", fontSize: 12 }}>
                (Auto-set to next session when you switch clients)
              </span>
            </div>

            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={10}
              placeholder={clientId ? "Paste transcript here..." : "Select a client first..."}
              disabled={!clientId}
              style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #ccc" }}
            />

            <div style={{ marginTop: 10 }}>
              <button onClick={generateAndSave} disabled={saving || !transcript.trim() || !clientId}>
                {saving ? "Generating..." : "Generate + Save"}
              </button>
            </div>

            <h3 style={{ marginTop: 16 }}>Latest Structured Note</h3>
            <pre
              style={{
                background: "#f6f6f6",
                padding: 12,
                borderRadius: 8,
                border: "1px solid #eee",
                whiteSpace: "pre-wrap",
                minHeight: 120,
              }}
            >
              {note || "No note yet."}
            </pre>
          </div>

          <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 14 }}>
            <h2 style={{ marginTop: 0 }}>Therapist Chat</h2>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
              Queries <b>{clientName || "—"}</b> using saved session notes (isolated memory).
            </div>

            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={clientId ? "Ask about patterns, progress, follow-ups..." : "Select a client first..."}
              disabled={!clientId}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
            />

            <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
              <button onClick={ask} disabled={asking || !question.trim() || !clientId}>
                {asking ? "Asking..." : "Ask"}
              </button>
              <button
                onClick={() => {
                  setQuestion("");
                  setAnswer("");
                }}
                disabled={asking}
              >
                Clear
              </button>
            </div>

            <h3 style={{ marginTop: 16 }}>Answer</h3>
            <pre
              style={{
                background: "#f6f6f6",
                padding: 12,
                borderRadius: 8,
                border: "1px solid #eee",
                whiteSpace: "pre-wrap",
                minHeight: 160,
              }}
            >
              {answer || "No answer yet."}
            </pre>

            <div style={{ fontSize: 12, color: "#777", marginTop: 10 }}>
              Note: This tool does not diagnose or provide medical advice.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
