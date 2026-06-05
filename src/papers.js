import * as cheerio from "cheerio";
import { XMLParser } from "fast-xml-parser";
import { scorePaperPopularity } from "./ranking.js";

const ARXIV_ENDPOINT = "https://export.arxiv.org/api/query";
const ARXIV_SEARCH_ENDPOINT = "https://arxiv.org/search/";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "text",
});

export const topics = [
  {
    id: "medical-imaging",
    name: "AI 医学影像",
    shortName: "医学影像",
    color: "#cf3f58",
    query:
      '(all:"medical imaging" OR all:radiology OR all:"medical image segmentation" OR all:MRI OR all:CT OR all:"computed tomography") AND (cat:cs.CV OR cat:cs.LG OR cat:eess.IV)',
    focus: ["segmentation", "radiology", "MRI", "CT", "foundation model"],
    webQuery:
      '"medical imaging" OR radiology OR "medical image segmentation" OR MRI OR "computed tomography"',
  },
  {
    id: "3d-reconstruction",
    name: "3D 重建",
    shortName: "3D 重建",
    color: "#0f8b8d",
    query:
      '(all:"3D reconstruction" OR all:NeRF OR all:"Gaussian Splatting" OR all:SLAM OR all:"mesh reconstruction" OR all:"multi-view stereo") AND (cat:cs.CV OR cat:cs.GR OR cat:cs.RO)',
    focus: ["3D reconstruction", "NeRF", "Gaussian Splatting", "SLAM", "mesh"],
    webQuery:
      '"3D reconstruction" OR NeRF OR "Gaussian Splatting" OR SLAM OR "mesh reconstruction"',
  },
  {
    id: "world-models",
    name: "世界模型",
    shortName: "世界模型",
    color: "#6a58c8",
    query:
      '(all:"world model" OR all:"world models" OR all:"video generation" OR all:"model-based reinforcement learning" OR all:"embodied AI" OR all:"simulation policy") AND (cat:cs.AI OR cat:cs.LG OR cat:cs.CV OR cat:cs.RO)',
    focus: ["world model", "video generation", "embodied AI", "planning", "RL"],
    webQuery:
      '"world model" OR "world models" OR "video generation" OR "model-based reinforcement learning" OR "embodied AI"',
  },
  {
    id: "continual-learning",
    name: "连续学习",
    shortName: "连续学习",
    color: "#2f6f4e",
    query:
      '(all:"continual learning" OR all:"lifelong learning" OR all:"catastrophic forgetting" OR all:"incremental learning" OR all:"online learning") AND (cat:cs.LG OR cat:cs.AI OR cat:cs.CV OR cat:cs.CL)',
    focus: [
      "continual learning",
      "lifelong learning",
      "catastrophic forgetting",
      "incremental learning",
      "online learning",
    ],
    webQuery:
      '"continual learning" OR "lifelong learning" OR "catastrophic forgetting" OR "incremental learning" OR "online learning"',
  },
  {
    id: "speculative-decoding",
    name: "投机解码",
    shortName: "投机解码",
    color: "#b45f06",
    query:
      '(all:"speculative decoding" OR all:"speculative sampling" OR all:"draft model" OR all:"LLM inference acceleration" OR all:"parallel decoding") AND (cat:cs.CL OR cat:cs.LG OR cat:cs.AI)',
    focus: [
      "speculative decoding",
      "speculative sampling",
      "draft model",
      "inference acceleration",
      "parallel decoding",
    ],
    webQuery:
      '"speculative decoding" OR "speculative sampling" OR "draft model" OR "LLM inference acceleration" OR "parallel decoding"',
  },
];

export async function fetchDailyPapers() {
  const papers = [];

  for (const [index, topic] of topics.entries()) {
    if (index > 0) {
      await wait(3100);
    }
    const topicPapers = await fetchArxivTopic(topic);
    papers.push(...topicPapers);
  }

  const ranked = rankAndDedupe(papers).map((paper) => ({
    ...paper,
    hotScore: scorePaperPopularity(paper),
  }));

  return {
    fetchedAt: Date.now(),
    papers: ranked,
    topics,
    error: null,
  };
}

async function fetchArxivTopic(topic) {
  const params = new URLSearchParams({
    search_query: topic.query,
    start: "0",
    max_results: "60",
    sortBy: "submittedDate",
    sortOrder: "descending",
  });

  try {
    const response = await fetchWithTimeout(`${ARXIV_ENDPOINT}?${params}`, 20000);

    if (!response.ok) {
      throw new Error(`arXiv API returned ${response.status}`);
    }

    const xml = await response.text();
    const feed = parser.parse(xml)?.feed;
    const entries = normalizeArray(feed?.entry);

    return entries.map((entry) => toPaper(entry, topic)).filter(Boolean);
  } catch (error) {
    console.warn(`${topic.name}: API unavailable, falling back to search page (${error.message})`);
    return fetchArxivSearchPage(topic);
  }
}

async function fetchArxivSearchPage(topic) {
  const params = new URLSearchParams({
    query: topic.webQuery,
    searchtype: "all",
    abstracts: "show",
    order: "-announced_date_first",
    size: "50",
  });
  const response = await fetchWithTimeout(`${ARXIV_SEARCH_ENDPOINT}?${params}`, 45000);

  if (!response.ok) {
    throw new Error(`arXiv search returned ${response.status} for ${topic.name}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const papers = [];

  $(".arxiv-result").each((_index, element) => {
    const item = $(element);
    const abstractUrl = item.find(".list-title a").first().attr("href") || "";
    const arxivId = cleanText(item.find(".list-title a").first().text()).replace(/^arXiv:/, "");
    const title = cleanText(item.find(".title").first().text()).replace(/^Title:\s*/i, "");
    const authors = item
      .find(".authors a")
      .map((_i, author) => cleanText($(author).text()))
      .get();
    const summary = cleanText(
      item.find(".abstract-full").first().text() || item.find(".abstract-short").first().text(),
    )
      .replace(/^Abstract:\s*/i, "")
      .replace(/\s*[△▽]\s*Less\s*$/i, "");
    const categories = item
      .find(".tags .tag")
      .map((_i, tag) => cleanText($(tag).text()))
      .get();
    const published = inferPublishedDate(item.text());

    if (!abstractUrl || !title) return;

    papers.push({
      id: abstractUrl,
      arxivId,
      title,
      authors,
      summary,
      published,
      updated: published,
      abstractUrl,
      pdfUrl: abstractUrl.replace("/abs/", "/pdf/"),
      topicId: topic.id,
      topicName: topic.name,
      topicColor: topic.color,
      categories,
      score: scorePaper({ title, summary, published }, topic),
    });
  });

  return papers.slice(0, 50);
}

function toPaper(entry, topic) {
  const id = String(entry.id || "").trim();
  const links = normalizeArray(entry.link);
  const pdfLink =
    links.find((link) => link.title === "pdf" || link.type === "application/pdf")?.href ||
    id.replace("/abs/", "/pdf/");

  return {
    id,
    arxivId: id.split("/").pop() || id,
    title: cleanText(entry.title),
    authors: normalizeArray(entry.author)
      .map((author) => cleanText(author.name))
      .filter(Boolean),
    summary: cleanText(entry.summary),
    published: entry.published,
    updated: entry.updated,
    abstractUrl: id,
    pdfUrl: pdfLink,
    topicId: topic.id,
    topicName: topic.name,
    topicColor: topic.color,
    categories: normalizeArray(entry.category).map((category) => category.term).filter(Boolean),
    score: scorePaper(entry, topic),
  };
}

function rankAndDedupe(papers) {
  const seen = new Map();

  for (const paper of papers) {
    const existing = seen.get(paper.id);
    if (!existing || paper.score > existing.score) {
      seen.set(paper.id, paper);
    }
  }

  return [...seen.values()].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(b.published).getTime() - new Date(a.published).getTime();
  });
}

function scorePaper(entry, topic) {
  const text = `${entry.title || ""} ${entry.summary || ""}`.toLowerCase();
  const focusScore = topic.focus.reduce((score, term) => {
    return score + (text.includes(term.toLowerCase()) ? 3 : 0);
  }, 0);
  const recencyScore = Math.max(0, 7 - daysSince(entry.published));
  return focusScore + recencyScore;
}

function daysSince(dateString) {
  const then = new Date(dateString).getTime();
  if (!Number.isFinite(then)) return 0;
  return Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
}

function normalizeArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "PaperPulse/1.0 (daily research digest; contact: local-user)",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

function inferPublishedDate(text) {
  const monthMatch = text.match(/originally announced\s+([A-Za-z]+)\s+(\d{4})/i);
  if (!monthMatch) return new Date().toISOString();

  const monthIndex = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ].indexOf(monthMatch[1].toLowerCase());

  if (monthIndex < 0) return new Date().toISOString();
  return new Date(Number(monthMatch[2]), monthIndex, 1).toISOString();
}
