import { summarizePaper } from "../src/ai-summary.js";
import { validateSummaryRequest } from "../src/request-validation.js";

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const validation = validateSummaryRequest(req.body);
  if (!validation.ok) {
    res.status(validation.status).json({ error: validation.error });
    return;
  }

  try {
    const summary = await summarizePaper(validation.paper);
    res.status(200).json({ aiSummary: summary });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to summarize paper",
    });
  }
}

function setCorsHeaders(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  const origin = req.headers.origin;

  if (!allowedOrigin || allowedOrigin === origin) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
