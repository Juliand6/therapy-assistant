import { useState } from "react";

const API_BASE = "http://localhost:8080";

const TRANSCRIPTS = {
  1: `Therapist: How has your week been?
Client: I’ve been anxious and not sleeping well. Work has been overwhelming.
Therapist: What happens at night?
Client: My mind races and I replay mistakes.`,
  2: `Therapist: Any changes since last week?
Client: I tried journaling twice. It helped a bit, but I still feel tense.
Therapist: What triggered it most?
Client: Meetings. I feel judged.`,
  3: `Therapist: What was the hardest moment this week?
Client: I avoided calling my friend back. I felt guilty after.
Therapist: What did you do instead?
Client: I stayed in bed and scrolled on my phone for hours.`,
};

export default function App() {
  // Add Session
  const [clientId] = useState("client_a"); // hard-coded selector (demo)
  const [sessionNumber, setSessionNumber] = useState(1);
  const [transcript, setTranscript] = useState(TRANSCRIPTS[1]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Chat
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);

  function loadTranscript(n) {
    setSessionNumber(n);
    setTranscript(TRANSCRIPTS[n]);
    setNote("");
  }

  async function generateAndSave() {
    setSaving(true);
    setNote("");

    try {
      const res = await fetch(`${API_BASE}/api/add-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId, // included for future expansion (server can ignore)
          transcript,
          sessionNumber,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Request failed");

      setNote(data.note);
    } catch (err) {
      setNote(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function ask() {
    setAsking(true);
    setAnswer("");

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId, // included for future expansion (server can ignore)
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
    <div style={{ maxWidth: 980, margin: "40px auto", fontFamily: "system-ui" }}>
      <h1 style={{ marginBottom: 6 }}>Therapy Assistant (MVP)</h1>
      <p style={{ marginTop: 0, color: "#555" }}>
        Therapist-only demo. Summarizes transcripts into structured notes and answers questions based on saved session
        notes.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 18,
          alignItems: "start",
          marginTop: 18,
        }}
      >
        {/* LEFT: Add Session */}
        <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 14 }}>
          <h2 style={{ marginTop: 0 }}>Add Session</h2>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <button onClick={() => loadTranscript(1)}>Load Transcript 1</button>
            <button onClick={() => loadTranscript(2)}>Load Transcript 2</button>
            <button onClick={() => loadTranscript(3)}>Load Transcript 3</button>
          </div>

          <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 12, color: "#666" }}>Client</div>
              <div style={{ fontWeight: 600 }}>Client A</div>
            </div>

            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, color: "#666" }}>Session #</span>
              <input
                type="number"
                min={1}
                value={sessionNumber}
                onChange={(e) => setSessionNumber(Number(e.target.value))}
                style={{ width: 90, padding: 8 }}
              />
            </label>
          </div>

          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={12}
            style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #ccc" }}
          />

          <div style={{ marginTop: 10 }}>
            <button onClick={generateAndSave} disabled={saving || !transcript.trim()}>
              {saving ? "Generating..." : "Generate + Save"}
            </button>
          </div>

          <h3 style={{ marginTop: 16 }}>Structured Note</h3>
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

        {/* RIGHT: Chat */}
        <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 14 }}>
          <h2 style={{ marginTop: 0 }}>Therapist Chat</h2>

          <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
            Asking about: <b>Client A</b> (uses saved session notes)
          </div>

          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g., What themes keep coming up across sessions?"
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />

          <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
            <button onClick={ask} disabled={asking || !question.trim()}>
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
              minHeight: 180,
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
  );
}
