import express from "express";
import { summarizePaper } from "./src/ai-summary.js";
import { fetchDailyPapers, topics } from "./src/papers.js";
import { validateSummaryRequest } from "./src/request-validation.js";

const app = express();
const PORT = Number(process.env.PORT || 4173);
const CACHE_TTL_MS = 1000 * 60 * 60 * 12;

let cache = {
  fetchedAt: 0,
  papers: [],
  topics,
  error: null,
};

app.use(express.static("public"));
app.use(express.json({ limit: "80kb" }));

app.get("/api/topics", (_req, res) => {
  res.json({ topics });
});

app.get("/api/papers", async (req, res) => {
  const force = req.query.refresh === "1";
  const now = Date.now();

  if (!force && cache.papers.length && now - cache.fetchedAt < CACHE_TTL_MS) {
    res.json({ ...cache, cached: true });
    return;
  }

  try {
    cache = await fetchDailyPapers();
    res.json({ ...cache, cached: false });
  } catch (error) {
    cache = {
      ...cache,
      error: error instanceof Error ? error.message : "Unknown fetch error",
    };
    res.status(cache.papers.length ? 200 : 502).json({
      ...cache,
      cached: Boolean(cache.fetchedAt),
    });
  }
});

app.post("/api/summarize", async (req, res) => {
  const validation = validateSummaryRequest(req.body);
  if (!validation.ok) {
    res.status(validation.status).json({ error: validation.error });
    return;
  }

  try {
    const summary = await summarizePaper(validation.paper);
    res.json({ aiSummary: summary });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to summarize paper",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Paper Pulse is running at http://localhost:${PORT}`);
});
