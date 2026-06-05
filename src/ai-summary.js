const OPENAI_ENDPOINT = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5-nano";
const DEFAULT_SUMMARY_LIMIT = 12;
const SUMMARY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: { type: "string" },
    bullets: {
      type: "array",
      items: { type: "string" },
      minItems: 3,
      maxItems: 3,
    },
    methods: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 4,
    },
    why_read: { type: "string" },
    limitations: { type: "string" },
    audience: { type: "string" },
  },
  required: ["headline", "bullets", "methods", "why_read", "limitations", "audience"],
};

export async function summarizePapers(papers, { apiKey = process.env.OPENAI_API_KEY } = {}) {
  if (!apiKey) {
    return new Map();
  }

  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const limit = getSummaryLimit(process.env.AI_SUMMARY_LIMIT);
  const summaries = new Map();
  const selectedPapers = papers.slice(0, limit);

  console.log(`AI summaries enabled: summarizing ${selectedPapers.length}/${papers.length} missing papers`);

  for (const paper of selectedPapers) {
    try {
      const summary = await summarizePaper(paper, { apiKey, model });
      summaries.set(paper.arxivId, summary);
      console.log(`Summarized ${paper.arxivId}`);
    } catch (error) {
      console.warn(`Skipped AI summary for ${paper.arxivId}: ${error.message}`);
    }
  }

  return summaries;
}

export function getSummaryLimit(value) {
  const parsed = Number(value || DEFAULT_SUMMARY_LIMIT);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_SUMMARY_LIMIT;
  }
  return Math.floor(parsed);
}

export async function summarizePaper(paper, { apiKey = process.env.OPENAI_API_KEY, model = process.env.OPENAI_MODEL || DEFAULT_MODEL } = {}) {
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await fetchWithTimeout(OPENAI_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      store: false,
      instructions:
        "你是一个中文科研论文助理。总结要准确、克制，不夸大论文贡献。只根据用户给出的题目和摘要总结，不补造实验结果。",
      input: JSON.stringify({
        task:
          "请把这篇论文总结成中文 JSON：headline 一句话结论；bullets 三个贡献点；methods 方法关键词；why_read 为什么值得看；limitations 一个局限或注意点；audience 适合谁读。",
        paper: {
          title: paper.title,
          authors: paper.authors,
          abstract: paper.summary,
          categories: paper.categories,
          topic: paper.topicName,
        },
      }),
      text: {
        format: {
          type: "json_schema",
          name: "paper_summary",
          strict: true,
          schema: SUMMARY_SCHEMA,
        },
      },
    }),
  }, 45000);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI returned ${response.status}: ${text.slice(0, 160)}`);
  }

  const data = await response.json();
  const content = extractResponseText(data);
  if (!content) {
    throw new Error("OpenAI response did not include content");
  }

  return normalizeSummary(JSON.parse(content));
}

function extractResponseText(data) {
  if (data.output_text) return data.output_text;

  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) {
        return content.text;
      }
    }
  }

  return "";
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeSummary(summary) {
  return {
    headline: String(summary.headline || "").trim(),
    bullets: normalizeStringArray(summary.bullets).slice(0, 3),
    methods: normalizeStringArray(summary.methods).slice(0, 4),
    why_read: String(summary.why_read || "").trim(),
    limitations: String(summary.limitations || "").trim(),
    audience: String(summary.audience || "").trim(),
  };
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}
