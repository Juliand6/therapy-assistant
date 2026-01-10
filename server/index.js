import express from "express";
import cors from "cors";
import "dotenv/config";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// Day 1: stub summarizer (replace with Backboard tomorrow)
app.post("/api/add-session", async (req, res) => {
  const { transcript, sessionNumber } = req.body;

  if (!transcript) {
    return res.status(400).json({ error: "Missing transcript" });
  }

  // Fake “structured note” for now
  const note = `SESSION #${sessionNumber ?? 1}
Summary:
- Client discussed stress and sleep issues
- Reported anxiety increasing during the week
Themes: anxiety, sleep, work stress
Risk flags: none noted
Next session focus:
- Sleep routine
- Coping strategies`;

  res.json({ note });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
