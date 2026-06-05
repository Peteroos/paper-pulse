const MAX_TEXT_LENGTH = 9000;

export function validateSummaryRequest(body = {}) {
  const paper = body.paper;

  if (!paper || typeof paper !== "object") {
    return { ok: false, status: 400, error: "Missing paper payload" };
  }

  const title = normalizeText(paper.title);
  const summary = normalizeText(paper.summary);

  if (!title || !summary) {
    return { ok: false, status: 400, error: "Paper title and summary are required" };
  }

  return {
    ok: true,
    paper: {
      arxivId: normalizeText(paper.arxivId).slice(0, 80),
      title: title.slice(0, 600),
      authors: Array.isArray(paper.authors)
        ? paper.authors.map((author) => normalizeText(author)).filter(Boolean).slice(0, 12)
        : [],
      summary: summary.slice(0, MAX_TEXT_LENGTH),
      categories: Array.isArray(paper.categories)
        ? paper.categories.map((category) => normalizeText(category)).filter(Boolean).slice(0, 12)
        : [],
      topicName: normalizeText(paper.topicName).slice(0, 80),
    },
  };
}

export function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}
