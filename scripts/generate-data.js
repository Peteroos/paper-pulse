import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchDailyPapers } from "../src/papers.js";
import { summarizePapers } from "../src/ai-summary.js";
import { findPapersMissingSummaries, mergeSummaryCache } from "../src/summary-cache.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dirname, "../public/data/papers.json");

const existingPayload = await readExistingPayload(outputPath);
const payload = await fetchDailyPapers();
const missingSummaryPapers = findPapersMissingSummaries(payload.papers, existingPayload);
const newSummaries = await summarizePapers(missingSummaryPapers);
const papers = mergeSummaryCache(payload.papers, existingPayload, newSummaries);
const outputPayload = {
  ...payload,
  papers,
  aiSummary: {
    enabled: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL || "gpt-5-nano",
    generatedAt: Date.now(),
    newSummaries: newSummaries.size,
    cachedSummaries: papers.filter((paper) => paper.aiSummary).length - newSummaries.size,
  },
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify({ ...outputPayload, cached: false }, null, 2)}\n`);

console.log(`Wrote ${papers.length} papers to ${outputPath}`);

async function readExistingPayload(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return {};
  }
}
