import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchDailyPapers } from "../src/papers.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dirname, "../public/data/papers.json");

const payload = await fetchDailyPapers();

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify({ ...payload, cached: false }, null, 2)}\n`);

console.log(`Wrote ${payload.papers.length} papers to ${outputPath}`);
