const VIEW_WINDOWS = {
  today: 2,
  week: 7,
  month: 30,
};

const IMPORTANT_TERMS = [
  "foundation model",
  "benchmark",
  "segmentation",
  "reconstruction",
  "gaussian splatting",
  "world model",
  "planning",
  "clinical",
  "dataset",
  "open-source",
];

export function filterPapersByView(papers, { viewMode = "today", activeTopic = "all", now = Date.now() } = {}) {
  const windowDays = VIEW_WINDOWS[viewMode] || VIEW_WINDOWS.today;

  return papers
    .map((paper) => ({
      ...paper,
      hotScore: scorePaperPopularity(paper, { now }),
    }))
    .filter((paper) => {
      const topicMatch = activeTopic === "all" || paper.topicId === activeTopic;
      const ageMatch = daysSince(paper.published, now) <= windowDays;
      return topicMatch && ageMatch;
    })
    .sort((a, b) => {
      if (b.hotScore !== a.hotScore) return b.hotScore - a.hotScore;
      return new Date(b.published).getTime() - new Date(a.published).getTime();
    });
}

export function getTopicLeaderboard(papers, { viewMode = "week", now = Date.now(), limit = 5 } = {}) {
  return papers.reduce((leaderboard, paper) => {
    const topicPapers = filterPapersByView(papers, {
      viewMode,
      activeTopic: paper.topicId,
      now,
    }).slice(0, limit);
    leaderboard[paper.topicId] = topicPapers;
    return leaderboard;
  }, {});
}

export function scorePaperPopularity(paper, { now = Date.now() } = {}) {
  const text = `${paper.title || ""} ${paper.summary || ""}`.toLowerCase();
  const keywordScore = IMPORTANT_TERMS.reduce((score, term) => {
    return score + (text.includes(term) ? 8 : 0);
  }, 0);
  const recencyScore = Math.max(0, 30 - daysSince(paper.published, now)) * 2;
  const sourceScore = Number(paper.score || 0);
  const authorScore = Math.min(8, paper.authors?.length || 0);
  return sourceScore + keywordScore + recencyScore + authorScore;
}

export function daysSince(dateString, now = Date.now()) {
  const then = new Date(dateString).getTime();
  if (!Number.isFinite(then)) return 0;
  return Math.max(0, Math.floor((now - then) / (1000 * 60 * 60 * 24)));
}
