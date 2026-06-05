import assert from "node:assert/strict";
import test from "node:test";
import { findPapersMissingSummaries, mergeSummaryCache } from "../src/summary-cache.js";

const existing = {
  papers: [
    {
      arxivId: "2606.1",
      aiSummary: {
        headline: "Cached",
        bullets: ["Already summarized"],
      },
    },
  ],
};

test("findPapersMissingSummaries skips papers already cached by arXiv id", () => {
  const papers = [
    { arxivId: "2606.1", title: "Already cached" },
    { arxivId: "2606.2", title: "Needs summary" },
  ];

  const missing = findPapersMissingSummaries(papers, existing);

  assert.deepEqual(
    missing.map((paper) => paper.arxivId),
    ["2606.2"],
  );
});

test("mergeSummaryCache preserves old summaries and attaches new summaries", () => {
  const papers = [
    { arxivId: "2606.1", title: "Already cached" },
    { arxivId: "2606.2", title: "Needs summary" },
  ];
  const summaries = new Map([
    [
      "2606.2",
      {
        headline: "New",
        bullets: ["Freshly summarized"],
      },
    ],
  ]);

  const merged = mergeSummaryCache(papers, existing, summaries);

  assert.equal(merged[0].aiSummary.headline, "Cached");
  assert.equal(merged[1].aiSummary.headline, "New");
});
