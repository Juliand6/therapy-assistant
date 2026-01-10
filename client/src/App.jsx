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
Client: I stayed in bed and scrolled on my phone for hours.`
};

export default function App() {
  const [sessionNumber, setSessionNumber] = useState(1);
  const [transcript, setTranscript] = useState(TRANSCRIPTS[1]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  async function generateAndSave() {
    setLoading(true);
    setNote("");

    try {
      const res = await fetch(`${API_BASE}/api/add-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, sessionNumber })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Request failed");

      setNote(data.note);
    } catch (err) {
      setNote(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  function loadTranscript(n) {
    setSessionNumber(n);
    setTranscript(TRANSCRIPTS[n]);
    setNote("");
  }

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", fontFamily: "system-ui" }}>
      <h1>Therapy Assistant (MVP)</h1>
      <p style={{ color: "#555" }}>
        Therapist-only demo. Generates structured notes from a transcript.
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <button onClick={() => loadTranscript(1)}>Load Transcript 1</button>
        <button onClick={() => loadTranscript(2)}>Load Transcript 2</button>
        <button onClick={() => loadTranscript(3)}>Load Transcript 3</button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label>
          Session #
          <input
            type="number"
            value={sessionNumber}
            onChange={(e) => setSessionNumber(Number(e.target.value))}
            style={{ marginLeft: 8, width: 80 }}
          />
        </label>
      </div>

      <textarea
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        rows={10}
        style={{ width: "100%", padding: 12 }}
      />

      <div style={{ marginTop: 12 }}>
        <button onClick={generateAndSave} disabled={loading}>
          {loading ? "Generating..." : "Generate + Save"}
        </button>
      </div>

      <h2 style={{ marginTop: 24 }}>Structured Note</h2>
      <pre style={{ background: "#f6f6f6", padding: 12, whiteSpace: "pre-wrap" }}>
        {note || "No note yet."}
      </pre>
    </div>
  );
}
