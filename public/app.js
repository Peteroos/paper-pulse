const state = {
  topics: [],
  papers: [],
  activeTopic: "all",
  selectedId: null,
  query: "",
  saved: new Set(JSON.parse(localStorage.getItem("paperPulse.saved") || "[]")),
  read: new Set(JSON.parse(localStorage.getItem("paperPulse.read") || "[]")),
  onlyFresh: localStorage.getItem("paperPulse.onlyFresh") === "true",
  deliveryTime: localStorage.getItem("paperPulse.deliveryTime") || "08:30",
  reminderTimer: null,
};

const els = {
  topicNav: document.querySelector("#topicNav"),
  summaryStrip: document.querySelector("#summaryStrip"),
  paperList: document.querySelector("#paperList"),
  detailPane: document.querySelector("#detailPane"),
  streamTitle: document.querySelector("#streamTitle"),
  fetchStatus: document.querySelector("#fetchStatus"),
  searchInput: document.querySelector("#searchInput"),
  refreshButton: document.querySelector("#refreshButton"),
  savedList: document.querySelector("#savedList"),
  onlyFresh: document.querySelector("#onlyFresh"),
  deliveryTime: document.querySelector("#deliveryTime"),
  notifyButton: document.querySelector("#notifyButton"),
  dateLine: document.querySelector("#dateLine"),
};

init();

async function init() {
  els.dateLine.textContent = new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "full",
  }).format(new Date());
  els.onlyFresh.checked = state.onlyFresh;
  els.deliveryTime.value = state.deliveryTime;
  bindEvents();
  scheduleReminder();
  renderLoading();
  await loadPapers();
}

function bindEvents() {
  els.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    render();
  });

  els.refreshButton.addEventListener("click", async () => {
    await loadPapers(true);
  });

  els.onlyFresh.addEventListener("change", (event) => {
    state.onlyFresh = event.target.checked;
    localStorage.setItem("paperPulse.onlyFresh", String(state.onlyFresh));
    render();
  });

  els.deliveryTime.addEventListener("change", (event) => {
    state.deliveryTime = event.target.value || "08:30";
    localStorage.setItem("paperPulse.deliveryTime", state.deliveryTime);
    scheduleReminder();
  });

  els.notifyButton.addEventListener("click", async () => {
    if (!("Notification" in window)) {
      els.fetchStatus.textContent = "当前浏览器不支持提醒";
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      localStorage.setItem("paperPulse.notifications", "true");
      scheduleReminder();
      new Notification("Paper Pulse", {
        body: `每日 ${state.deliveryTime} 查看你的论文推送。`,
      });
    }
  });
}

async function loadPapers(force = false) {
  els.fetchStatus.textContent = force ? "正在检查最新数据" : "正在加载今日论文";
  els.refreshButton.disabled = true;

  try {
    const data = await fetchPaperData(force);
    state.topics = data.topics;
    state.papers = data.papers;
    if (!state.selectedId && state.papers.length) {
      state.selectedId = state.papers[0].id;
    }
    const fetchedAt = data.fetchedAt ? formatTime(data.fetchedAt) : "刚刚";
    els.fetchStatus.textContent = data.error ? `使用缓存：${data.error}` : `更新于 ${fetchedAt}`;
    render();
  } catch (error) {
    els.fetchStatus.textContent = `加载失败：${error.message}`;
    render();
  } finally {
    els.refreshButton.disabled = false;
  }
}

async function fetchPaperData(force) {
  const cacheKey = force ? `?t=${Date.now()}` : "";
  const endpoints = [
    `data/papers.json${cacheKey}`,
    `api/papers${force ? "?refresh=1" : ""}`,
  ];

  let lastError;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`${endpoint} returned ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("无法加载论文数据");
}

function render() {
  renderTopics();
  renderSummary();
  renderPaperList();
  renderDetail();
  renderSaved();
  window.lucide?.createIcons();
}

function renderLoading() {
  els.paperList.innerHTML = `<div class="loading-card">正在连接 arXiv API...</div>`;
}

function renderTopics() {
  const counts = getCounts();
  const buttons = [
    { id: "all", name: "全部方向", color: "#191816", count: filteredPapers("all").length },
    ...state.topics.map((topic) => ({
      ...topic,
      count: counts[topic.id] || 0,
    })),
  ];

  els.topicNav.innerHTML = buttons
    .map(
      (topic) => `
        <button class="topic-button ${state.activeTopic === topic.id ? "active" : ""}"
          style="--topic-color: ${topic.color}" data-topic="${topic.id}" type="button">
          <span class="topic-dot"></span>
          <span class="topic-name">${topic.name}</span>
          <span class="topic-count">${topic.count}</span>
        </button>
      `,
    )
    .join("");

  els.topicNav.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeTopic = button.dataset.topic;
      const papers = filteredPapers();
      state.selectedId = papers[0]?.id || null;
      render();
    });
  });
}

function renderSummary() {
  const freshCount = state.papers.filter((paper) => daysSince(paper.published) <= 7).length;
  const savedCount = state.saved.size;
  const unreadCount = state.papers.filter((paper) => !state.read.has(paper.id)).length;
  const topTopic = getTopTopic();

  const metrics = [
    [state.papers.length, "今日候选论文"],
    [freshCount, "7 天内新增"],
    [savedCount, "已保存论文"],
    [topTopic, "最活跃方向"],
  ];

  els.summaryStrip.innerHTML = metrics
    .map(
      ([value, label]) => `
        <article class="metric">
          <p class="metric-value">${value}</p>
          <p class="metric-label">${label}</p>
        </article>
      `,
    )
    .join("");
}

function renderPaperList() {
  const papers = filteredPapers();
  const activeTopic = state.topics.find((topic) => topic.id === state.activeTopic);
  els.streamTitle.textContent = activeTopic?.name || "全部方向";

  if (!papers.length) {
    els.paperList.innerHTML = `<div class="empty-card">没有匹配论文，换个关键词或关闭 7 天过滤。</div>`;
    return;
  }

  els.paperList.innerHTML = papers
    .map((paper) => {
      const saved = state.saved.has(paper.id);
      const read = state.read.has(paper.id);
      return `
        <article class="paper-card ${state.selectedId === paper.id ? "selected" : ""}"
          style="--topic-color: ${paper.topicColor}" data-id="${paper.id}">
          <div>
            <div class="paper-meta-row">
              <span class="badge">${paper.topicName}</span>
              <span class="paper-date">${formatDate(paper.published)}</span>
              ${read ? `<span class="paper-date">已读</span>` : ""}
            </div>
            <h4 class="paper-title">${escapeHtml(paper.title)}</h4>
            <p class="paper-authors">${escapeHtml(formatAuthors(paper.authors))}</p>
            <p class="paper-summary">${escapeHtml(paper.summary)}</p>
          </div>
          <div class="paper-actions">
            <button class="icon-button save-button" title="${saved ? "取消保存" : "保存"}" type="button">
              <i data-lucide="${saved ? "bookmark-check" : "bookmark"}"></i>
            </button>
            <button class="icon-button read-button" title="${read ? "标为未读" : "标为已读"}" type="button">
              <i data-lucide="${read ? "mail-open" : "mail"}"></i>
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  els.paperList.querySelectorAll(".paper-card").forEach((card) => {
    card.addEventListener("click", () => {
      state.selectedId = card.dataset.id;
      state.read.add(card.dataset.id);
      persist("read");
      render();
    });

    card.querySelector(".save-button").addEventListener("click", (event) => {
      event.stopPropagation();
      toggleSet(state.saved, card.dataset.id);
      persist("saved");
      render();
    });

    card.querySelector(".read-button").addEventListener("click", (event) => {
      event.stopPropagation();
      toggleSet(state.read, card.dataset.id);
      persist("read");
      render();
    });
  });
}

function renderDetail() {
  const paper = state.papers.find((item) => item.id === state.selectedId);

  if (!paper) {
    els.detailPane.innerHTML = `
      <div class="empty-detail">
        <i data-lucide="scan-text"></i>
        <p>选择一篇论文查看摘要和链接</p>
      </div>
    `;
    return;
  }

  els.detailPane.style.setProperty("--topic-color", paper.topicColor);
  els.detailPane.innerHTML = `
    <span class="badge detail-topic">${paper.topicName}</span>
    <h3>${escapeHtml(paper.title)}</h3>
    <p class="detail-authors">${escapeHtml(formatAuthors(paper.authors, 8))}</p>
    <p class="detail-summary">${escapeHtml(paper.summary)}</p>
    <div class="category-list">
      ${paper.categories.slice(0, 6).map((category) => `<span class="category-pill">${category}</span>`).join("")}
    </div>
    <div class="detail-links">
      <a class="detail-link primary" href="${paper.abstractUrl}" target="_blank" rel="noreferrer">摘要页</a>
      <a class="detail-link" href="${paper.pdfUrl}" target="_blank" rel="noreferrer">PDF</a>
    </div>
  `;
}

function renderSaved() {
  const savedPapers = state.papers.filter((paper) => state.saved.has(paper.id)).slice(0, 5);
  if (!savedPapers.length) {
    els.savedList.innerHTML = `<p class="empty-list">还没有保存的论文</p>`;
    return;
  }

  els.savedList.innerHTML = savedPapers
    .map((paper) => `<div class="saved-item">${escapeHtml(paper.title)}</div>`)
    .join("");
}

function filteredPapers(topicId = state.activeTopic) {
  return state.papers.filter((paper) => {
    const topicMatch = topicId === "all" || paper.topicId === topicId;
    const freshMatch = !state.onlyFresh || daysSince(paper.published) <= 7;
    const queryMatch =
      !state.query ||
      `${paper.title} ${paper.summary} ${paper.authors.join(" ")}`
        .toLowerCase()
        .includes(state.query);
    return topicMatch && freshMatch && queryMatch;
  });
}

function getCounts() {
  return state.papers.reduce((acc, paper) => {
    acc[paper.topicId] = (acc[paper.topicId] || 0) + 1;
    return acc;
  }, {});
}

function getTopTopic() {
  const counts = getCounts();
  const top = state.topics
    .map((topic) => ({ ...topic, count: counts[topic.id] || 0 }))
    .sort((a, b) => b.count - a.count)[0];
  return top?.shortName || "-";
}

function formatAuthors(authors, limit = 4) {
  if (!authors?.length) return "作者未知";
  const visible = authors.slice(0, limit).join(", ");
  return authors.length > limit ? `${visible} 等 ${authors.length} 人` : visible;
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
  }).format(new Date(dateString));
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function daysSince(dateString) {
  const then = new Date(dateString).getTime();
  if (!Number.isFinite(then)) return 0;
  return Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
}

function toggleSet(set, id) {
  if (set.has(id)) {
    set.delete(id);
  } else {
    set.add(id);
  }
}

function persist(key) {
  localStorage.setItem(`paperPulse.${key}`, JSON.stringify([...state[key]]));
}

function scheduleReminder() {
  if (state.reminderTimer) {
    clearTimeout(state.reminderTimer);
  }

  if (
    localStorage.getItem("paperPulse.notifications") !== "true" ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) {
    return;
  }

  const [hour, minute] = state.deliveryTime.split(":").map(Number);
  const next = new Date();
  next.setHours(hour, minute, 0, 0);
  if (next <= new Date()) {
    next.setDate(next.getDate() + 1);
  }

  state.reminderTimer = setTimeout(() => {
    new Notification("Paper Pulse 今日论文", {
      body: "AI 医学影像、3D 重建、世界模型方向已准备好。",
    });
    scheduleReminder();
  }, next.getTime() - Date.now());
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
