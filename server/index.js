import express from "express";
import cors from "cors";
import "dotenv/config";
import { bbSummarizeAndStore, bbChat, bbGetSessions } from "./backboard.js";



const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/clients/:clientId/sessions", (req, res) => {
  const { clientId } = req.params;
  if (!clientId) return res.status(400).json({ error: "Missing clientId" });

  const sessions = bbGetSessions(clientId);
  res.json({ sessions });
});


app.post("/api/add-session", async (req, res) => {
  try {
    const { clientId, transcript, sessionNumber } = req.body;
    if (!clientId) return res.status(400).json({ error: "Missing clientId" });
    if (!transcript) return res.status(400).json({ error: "Missing transcript" });

    const note = await bbSummarizeAndStore({ clientId, transcript, sessionNumber });
    res.json({ note });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || "add-session failed" });
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    const { clientId, question } = req.body;
    if (!clientId) return res.status(400).json({ error: "Missing clientId" });
    if (!question) return res.status(400).json({ error: "Missing question" });

    const answer = await bbChat({ clientId, question });
    res.json({ answer });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || "chat failed" });
  }
});



const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
