export function findPapersMissingSummaries(papers, existingPayload = {}) {
  const cached = buildSummaryCache(existingPayload);
  return papers.filter((paper) => !cached.has(paper.arxivId));
}

export function mergeSummaryCache(papers, existingPayload = {}, newSummaries = new Map()) {
  const cached = buildSummaryCache(existingPayload);

  return papers.map((paper) => {
    const aiSummary = newSummaries.get(paper.arxivId) || cached.get(paper.arxivId);
    return aiSummary ? { ...paper, aiSummary } : paper;
  });
}

export function buildSummaryCache(existingPayload = {}) {
  const entries = existingPayload.papers || [];
  return new Map(
    entries
      .filter((paper) => paper.arxivId && paper.aiSummary)
      .map((paper) => [paper.arxivId, paper.aiSummary]),
  );
}
