import express from "express";
import cors from "cors";
import "dotenv/config";
import { bbSummarizeAndStore, bbChat } from "./backboard.js";


const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/add-session", async (req, res) => {
  try {
    const { transcript, sessionNumber } = req.body;
    if (!transcript) return res.status(400).json({ error: "Missing transcript" });

    const note = await bbSummarizeAndStore({ transcript, sessionNumber });
    res.json({ note });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || "add-session failed" });
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: "Missing question" });

    const answer = await bbChat({ question });
    res.json({ answer });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || "chat failed" });
  }
});


const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
