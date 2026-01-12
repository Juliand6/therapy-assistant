import { useEffect, useMemo, useState } from "react";

const API_BASE = "http://localhost:8080";

export default function App() {

  const [snapshot, setSnapshot] = useState(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);


  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);



  const [transcript, setTranscript] = useState("");
  const [sessionNumber, setSessionNumber] = useState(1);
  const [note, setNote] = useState(null);
  const [saving, setSaving] = useState(false);

  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

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
  }, []);

  useEffect(() => {
    setNote("");
    setAnswer("");
    setQuestion("");
    setTranscript("");
    fetchSessions(clientId);
    fetchSnapshot(clientId);

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

  async function fetchSnapshot(forClientId = clientId) {
  if (!forClientId) return;

  setLoadingSnapshot(true);
  setSnapshot("");
  try {
    const res = await fetch(`${API_BASE}/api/clients/${forClientId}/snapshot`);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Failed to load snapshot");
    setSnapshot(data.snapshot || null);
  } catch (err) {
    setSnapshot(`Error loading snapshot: ${err.message}`);
  } finally {
    setLoadingSnapshot(false);
  }
}

function Chip({ text }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: 999,
        border: "1px solid #ddd",
        background: "#fafafa",
        fontSize: 12,
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      {text}
    </span>
  );
}

function Section({ title, items, emptyText = "—" }) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12, background: "#fff" }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
      {Array.isArray(items) && items.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {items.map((x, i) => (
            <li key={i} style={{ marginBottom: 6, color: "#333" }}>
              {x}
            </li>
          ))}
        </ul>
      ) : (
        <div style={{ color: "#777" }}>{emptyText}</div>
      )}
    </div>
  );
}

function NoteCard({ note }) {
  if (!note) return <div style={{ color: "#777" }}>No note yet.</div>;

  if (note.error) {
    return (
      <div>
        <div style={{ color: "#b00020", fontWeight: 700 }}>Note parse error</div>
        <pre style={{ whiteSpace: "pre-wrap", background: "#f6f6f6", padding: 12, borderRadius: 10 }}>
          {note.raw}
        </pre>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Themes */}
      <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, background: "#fff" }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Themes</div>
        <div>
          {(note.themes || []).map((t, i) => (
            <Chip key={i} text={t} />
          ))}
          {(!note.themes || note.themes.length === 0) && <span style={{ color: "#777" }}>—</span>}
        </div>
      </div>

      {/* Main sections */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Section title="Summary" items={note.summary} />
        <Section title="Emotions observed" items={note.emotions_observed} />
        <Section title="Coping strategies" items={note.coping_strategies} />
        <Section title="Risk flags" items={note.risk_flags} emptyText="None noted" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Section title="Therapist follow-ups" items={note.therapist_followups} />
        <Section title="Next session focus" items={note.next_session_focus} />
      </div>

      {/* Quotes (optional) */}
      {Array.isArray(note.quotes) && note.quotes.length > 0 && (
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, background: "#fff" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Key quotes</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {note.quotes.map((q, i) => (
              <li key={i} style={{ marginBottom: 6 }}>
                “{q}”
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
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
              onKeyDown={(e) => {
                if (e.key === "Enter") createClient();
              }}
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
        {/* LEFT COLUMN */}
        <div>
          {/* Snapshot Card */}
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 14,
              padding: 14,
              marginBottom: 18,
              background: "#fff",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ margin: 0 }}>Client Snapshot</h2>
                <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                  Confidence: <b>{snapshot?.confidence ?? "—"}</b>
                </div>
              </div>

              <button onClick={() => fetchSnapshot(clientId)} disabled={loadingSnapshot || !clientId}>
                {loadingSnapshot ? "Updating..." : "Refresh"}
              </button>
            </div>

            {!clientId ? (
              <div style={{ color: "#777", marginTop: 10 }}>Select a client.</div>
            ) : loadingSnapshot ? (
              <div style={{ color: "#777", marginTop: 10 }}>Generating snapshot…</div>
            ) : snapshot?.error ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ color: "#b00020", fontWeight: 700 }}>Snapshot parse error</div>
                <pre style={{ whiteSpace: "pre-wrap", background: "#f6f6f6", padding: 12, borderRadius: 10 }}>
                  {snapshot.raw}
                </pre>
              </div>
            ) : snapshot ? (
              <div style={{ marginTop: 12 }}>
                <div style={{ marginBottom: 10 }}>
                  {(snapshot.primary_themes || []).map((t, i) => (
                    <Chip key={i} text={t} />
                  ))}
                  {(!snapshot.primary_themes || snapshot.primary_themes.length === 0) && (
                    <span style={{ color: "#777" }}>No themes yet.</span>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Section title="Progress since first" items={snapshot.progress_since_first} />
                  <Section title="Current challenges" items={snapshot.current_challenges} />
                  <Section title="Coping strategies tried" items={snapshot.coping_strategies_tried} />
                  <Section title="Risk flags" items={snapshot.risk_flags} emptyText="None noted" />
                </div>

                <div style={{ marginTop: 12 }}>
                  <Section title="Suggested next session focus" items={snapshot.suggested_next_focus} />
                </div>
              </div>
            ) : (
              <div style={{ color: "#777", marginTop: 10 }}>No snapshot yet. Add a session first.</div>
            )}
          </div>

          {/* Past Sessions */}
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
                      style={{
                        border: "1px solid #eee",
                        borderRadius: 10,
                        padding: 10,
                        background: "#fafafa",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <b>Session #{s.sessionNumber}</b>
                        <span style={{ color: "#777", fontSize: 12 }}>
                          {s.createdAt ? new Date(s.createdAt).toLocaleString() : ""}
                        </span>
                      </div>
                      <div style={{ marginTop: 10 }}>
  <NoteCard note={s.note} />
</div>

                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: "grid", gap: 18 }}>
          {/* Add Session */}
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
<div style={{ background: "#f6f6f6", padding: 12, borderRadius: 12, border: "1px solid #eee" }}>
  <NoteCard note={note} />
</div>

          </div>

          {/* Chat */}
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
