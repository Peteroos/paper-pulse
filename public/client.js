import { isAccessCodeValid } from "./access-code.js";

const state = {
  topics: [],
  papers: [],
  accessGranted: localStorage.getItem("paperPulse.accessGranted") === "true",
  appStarted: false,
  activeTopic: localStorage.getItem("paperPulse.activeTopic") || "",
  selectedId: null,
  query: "",
  viewMode: localStorage.getItem("paperPulse.viewMode") || "today",
  saved: new Set(JSON.parse(localStorage.getItem("paperPulse.saved") || "[]")),
  read: new Set(JSON.parse(localStorage.getItem("paperPulse.read") || "[]")),
  subscriptionEmail: localStorage.getItem("paperPulse.subscriptionEmail") || "",
  subscriptionTopics: new Set(
    JSON.parse(localStorage.getItem("paperPulse.subscriptionTopics") || "[]"),
  ),
  subscriptionMessage: "",
  subscriptionError: "",
  subscribing: false,
  summaryCache: JSON.parse(localStorage.getItem("paperPulse.aiSummaries") || "{}"),
  summarizing: new Set(),
  summaryErrors: new Map(),
};

const els = {
  accessGate: document.querySelector("#accessGate"),
  accessForm: document.querySelector("#accessForm"),
  accessCode: document.querySelector("#accessCode"),
  accessError: document.querySelector("#accessError"),
  appShell: document.querySelector("#appShell"),
  topicNav: document.querySelector("#topicNav"),
  summaryStrip: document.querySelector("#summaryStrip"),
  paperList: document.querySelector("#paperList"),
  detailPane: document.querySelector("#detailPane"),
  streamTitle: document.querySelector("#streamTitle"),
  fetchStatus: document.querySelector("#fetchStatus"),
  searchInput: document.querySelector("#searchInput"),
  refreshButton: document.querySelector("#refreshButton"),
  viewTabs: document.querySelector("#viewTabs"),
  savedList: document.querySelector("#savedList"),
  subscriptionForm: document.querySelector("#subscriptionForm"),
  emailInput: document.querySelector("#emailInput"),
  subscriptionTopics: document.querySelector("#subscriptionTopics"),
  subscriptionStatus: document.querySelector("#subscriptionStatus"),
  selectAllTopics: document.querySelector("#selectAllTopics"),
  subscribeButton: document.querySelector("#subscribeButton"),
  dateLine: document.querySelector("#dateLine"),
};

init();

async function init() {
  bindAccessGate();

  if (!state.accessGranted) {
    els.accessCode.focus();
    window.lucide?.createIcons();
    return;
  }

  await startApp();
}

async function startApp() {
  if (state.appStarted) {
    return;
  }

  state.appStarted = true;
  document.body.classList.add("access-granted");
  els.appShell.setAttribute("aria-hidden", "false");
  els.dateLine.textContent = new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "full",
  }).format(new Date());
  els.emailInput.value = state.subscriptionEmail;
  bindEvents();
  renderLoading();
  await loadPapers();
}

function bindAccessGate() {
  els.accessForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const code = els.accessCode.value.trim();

    if (!isAccessCodeValid(code)) {
      els.accessError.textContent = "访问码不正确。";
      els.accessCode.select();
      return;
    }

    localStorage.setItem("paperPulse.accessGranted", "true");
    state.accessGranted = true;
    els.accessError.textContent = "";
    await startApp();
  });
}

function bindEvents() {
  els.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    render();
  });

  els.refreshButton.addEventListener("click", async () => {
    await loadPapers(true);
  });

  els.viewTabs.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.viewMode = button.dataset.view;
      localStorage.setItem("paperPulse.viewMode", state.viewMode);
      const papers = filteredPapers();
      state.selectedId = papers[0]?.id || null;
      render();
    });
  });

  els.emailInput.addEventListener("input", (event) => {
    state.subscriptionEmail = event.target.value.trim();
    localStorage.setItem("paperPulse.subscriptionEmail", state.subscriptionEmail);
  });

  els.selectAllTopics.addEventListener("click", () => {
    state.subscriptionTopics = new Set(state.topics.map((topic) => topic.id));
    persistSubscriptionTopics();
    renderSubscriptionTopics();
  });

  els.subscriptionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveSubscription();
  });
}

async function loadPapers(force = false) {
  els.fetchStatus.textContent = force ? "正在检查最新数据" : "正在加载今日论文";
  els.refreshButton.disabled = true;

  try {
    const data = await fetchPaperData(force);
    state.topics = data.topics;
    state.papers = data.papers.map((paper) => {
      const cachedSummary = state.summaryCache[paper.arxivId];
      return cachedSummary && !paper.aiSummary ? { ...paper, aiSummary: cachedSummary } : paper;
    });
    normalizeActiveTopic();
    initializeSubscriptionTopics();
    if (!state.selectedId && state.papers.length) {
      state.selectedId = filteredPapers()[0]?.id || state.papers[0].id;
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
  renderViewTabs();
  renderSummary();
  renderPaperList();
  renderDetail();
  renderSaved();
  renderSubscriptionTopics();
  window.lucide?.createIcons();
}

function renderViewTabs() {
  els.viewTabs.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.viewMode);
  });
}

function renderLoading() {
  els.paperList.innerHTML = `<div class="loading-card">正在连接 arXiv API...</div>`;
}

function renderTopics() {
  const counts = getCounts();
  const buttons = state.topics.map((topic) => ({
    ...topic,
    count: counts[topic.id] || 0,
  }));

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
      localStorage.setItem("paperPulse.activeTopic", state.activeTopic);
      const papers = filteredPapers();
      state.selectedId = papers[0]?.id || null;
      render();
    });
  });
}

function renderSummary() {
  const freshCount = state.papers.filter((paper) => daysSince(paper.published) <= 7).length;
  const savedCount = state.saved.size;
  const topTopic = getTopTopic();
  const aiCount = state.papers.filter((paper) => paper.aiSummary).length;

  const metrics = [
    [state.papers.length, "今日候选论文"],
    [freshCount, "7 天内新增"],
    [topTopic, `${getViewLabel()}最活跃`],
    [aiCount || savedCount, aiCount ? "AI 总结覆盖" : "已保存论文"],
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
  els.streamTitle.textContent = `${activeTopic?.name || "论文方向"} · ${getViewLabel()}`;

  if (!papers.length) {
    els.paperList.innerHTML = `<div class="empty-card">没有匹配论文，换个关键词或切换方向。</div>`;
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
              ${state.viewMode !== "today" ? `<span class="paper-date">热度 ${Math.round(paper.hotScore || 0)}</span>` : ""}
              ${paper.aiSummary ? `<span class="paper-date">AI 总结</span>` : ""}
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
  const summary = paper.aiSummary;
  const isSummarizing = state.summarizing.has(paper.id);
  const summaryError = state.summaryErrors.get(paper.id);
  els.detailPane.innerHTML = `
    <div class="detail-head">
      <span class="badge detail-topic">${paper.topicName}</span>
      ${paper.aiSummary ? `<span class="detail-chip">AI 总结</span>` : `<span class="detail-chip muted">原始摘要</span>`}
    </div>
    <h3>${escapeHtml(paper.title)}</h3>
    <p class="detail-authors">${escapeHtml(formatAuthors(paper.authors, 8))}</p>
    ${
      summary
        ? `
          <section class="ai-summary">
            <p class="ai-headline">${escapeHtml(summary.headline)}</p>
            <div class="detail-block">
              <h4>核心贡献</h4>
              <ul>${summary.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
            </div>
            <div class="detail-block">
              <h4>为什么值得看</h4>
              <p>${escapeHtml(summary.why_read)}</p>
            </div>
            <div class="detail-block two-col">
              <div>
                <h4>方法关键词</h4>
                <div class="method-list">
                  ${summary.methods.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
                </div>
              </div>
              <div>
                <h4>适合谁读</h4>
                <p>${escapeHtml(summary.audience)}</p>
              </div>
            </div>
            <div class="detail-block caution">
              <h4>注意点</h4>
              <p>${escapeHtml(summary.limitations)}</p>
            </div>
          </section>
        `
        : `<p class="detail-summary">${escapeHtml(paper.summary)}</p>`
    }
    ${
      summary
        ? ""
        : `
          <button class="summary-button" id="summaryButton" type="button" ${isSummarizing ? "disabled" : ""}>
            <i data-lucide="${isSummarizing ? "loader-circle" : "sparkles"}"></i>
            <span>${isSummarizing ? "正在生成总结" : "生成 AI 总结"}</span>
          </button>
          ${summaryError ? `<p class="summary-error">${escapeHtml(summaryError)}</p>` : ""}
        `
    }
    <details class="abstract-details">
      <summary>原始摘要</summary>
      <p class="detail-summary">${escapeHtml(paper.summary)}</p>
    </details>
    <div class="category-list">
      ${paper.categories.slice(0, 6).map((category) => `<span class="category-pill">${category}</span>`).join("")}
    </div>
    <div class="detail-links">
      <a class="detail-link primary" href="${paper.abstractUrl}" target="_blank" rel="noreferrer">摘要页</a>
      <a class="detail-link" href="${paper.pdfUrl}" target="_blank" rel="noreferrer">PDF</a>
    </div>
  `;

  const summaryButton = els.detailPane.querySelector("#summaryButton");
  if (summaryButton) {
    summaryButton.addEventListener("click", () => {
      summarizeSelectedPaper(paper);
    });
  }
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

function renderSubscriptionTopics() {
  if (!state.topics.length) {
    els.subscriptionTopics.innerHTML = `<p class="empty-list">方向加载中</p>`;
    return;
  }

  els.subscriptionTopics.innerHTML = state.topics
    .map(
      (topic) => `
        <label class="topic-check" style="--topic-color: ${topic.color}">
          <input type="checkbox" value="${topic.id}" ${state.subscriptionTopics.has(topic.id) ? "checked" : ""} />
          <span class="topic-dot"></span>
          <span>${escapeHtml(topic.name)}</span>
        </label>
      `,
    )
    .join("");

  els.subscriptionTopics.querySelectorAll("input").forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) {
        state.subscriptionTopics.add(input.value);
      } else {
        state.subscriptionTopics.delete(input.value);
      }
      state.subscriptionMessage = "";
      state.subscriptionError = "";
      persistSubscriptionTopics();
      renderSubscriptionStatus();
    });
  });

  renderSubscriptionStatus();
}

function renderSubscriptionStatus() {
  els.subscribeButton.disabled = state.subscribing;
  els.subscriptionStatus.classList.toggle("error", Boolean(state.subscriptionError));
  els.subscriptionStatus.classList.toggle("success", Boolean(state.subscriptionMessage));
  const buttonLabel = els.subscribeButton.querySelector("span");
  if (buttonLabel) {
    buttonLabel.textContent = state.subscribing ? "正在保存" : "订阅每日推送";
  }

  if (state.subscriptionError) {
    els.subscriptionStatus.textContent = state.subscriptionError;
    return;
  }

  if (state.subscriptionMessage) {
    els.subscriptionStatus.textContent = state.subscriptionMessage;
    return;
  }

  els.subscriptionStatus.textContent = `每天 08:30 左右发送 ${state.subscriptionTopics.size || 0} 个方向的热门论文。`;
}

function filteredPapers(topicId = state.activeTopic) {
  const windowDays = getViewWindowDays();

  return state.papers
    .filter((paper) => {
      const topicMatch = paper.topicId === topicId;
      const viewMatch = daysSince(paper.published) <= windowDays;
      const queryMatch =
        !state.query ||
        `${paper.title} ${paper.summary} ${paper.authors.join(" ")}`
          .toLowerCase()
          .includes(state.query);
      return topicMatch && viewMatch && queryMatch;
    })
    .sort((a, b) => {
      if (state.viewMode !== "today") {
        return Number(b.hotScore || 0) - Number(a.hotScore || 0);
      }
      return new Date(b.published).getTime() - new Date(a.published).getTime();
    });
}

function getCounts() {
  return state.papers.filter((paper) => daysSince(paper.published) <= getViewWindowDays()).reduce((acc, paper) => {
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

function getViewWindowDays() {
  return {
    today: 2,
    week: 7,
    month: 30,
  }[state.viewMode] || 2;
}

function getViewLabel() {
  return {
    today: "今日",
    week: "本周热门",
    month: "本月热门",
  }[state.viewMode] || "今日";
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

function persistSubscriptionTopics() {
  localStorage.setItem(
    "paperPulse.subscriptionTopics",
    JSON.stringify([...state.subscriptionTopics]),
  );
}

function normalizeActiveTopic() {
  if (state.topics.some((topic) => topic.id === state.activeTopic)) {
    return;
  }

  state.activeTopic = state.topics[0]?.id || "";
  if (state.activeTopic) {
    localStorage.setItem("paperPulse.activeTopic", state.activeTopic);
  }
}

function initializeSubscriptionTopics() {
  const allowedTopicIds = new Set(state.topics.map((topic) => topic.id));
  state.subscriptionTopics = new Set(
    [...state.subscriptionTopics].filter((topicId) => allowedTopicIds.has(topicId)),
  );

  if (!state.subscriptionTopics.size) {
    state.subscriptionTopics = new Set(state.topics.map((topic) => topic.id));
  }

  persistSubscriptionTopics();
}

async function saveSubscription() {
  state.subscriptionEmail = els.emailInput.value.trim();
  localStorage.setItem("paperPulse.subscriptionEmail", state.subscriptionEmail);
  state.subscriptionMessage = "";
  state.subscriptionError = "";

  if (!state.subscriptionEmail) {
    state.subscriptionError = "请先输入邮箱。";
    renderSubscriptionStatus();
    return;
  }

  if (!state.subscriptionTopics.size) {
    state.subscriptionError = "至少选择一个方向。";
    renderSubscriptionStatus();
    return;
  }

  state.subscribing = true;
  renderSubscriptionStatus();

  try {
    const response = await fetch(`${getApiBase()}api/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: state.subscriptionEmail,
        topicIds: [...state.subscriptionTopics],
      }),
    });

    const payload = await safeReadJson(response);
    if (!response.ok) {
      throw new Error(payload.error || `API returned ${response.status}`);
    }

    state.subscriptionMessage = payload.message || "订阅已保存。";
  } catch (error) {
    state.subscriptionError =
      location.hostname.endsWith("github.io") && !window.PAPER_PULSE_API_BASE
        ? "GitHub Pages 不能保存邮箱。请使用 Vercel 网址，或在 config.js 配置 PAPER_PULSE_API_BASE。"
        : error.message;
  } finally {
    state.subscribing = false;
    renderSubscriptionStatus();
  }
}

async function summarizeSelectedPaper(paper) {
  state.summarizing.add(paper.id);
  state.summaryErrors.delete(paper.id);
  renderDetail();
  window.lucide?.createIcons();

  try {
    const response = await fetch(`${getApiBase()}api/summarize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        paper: {
          arxivId: paper.arxivId,
          title: paper.title,
          authors: paper.authors,
          summary: paper.summary,
          categories: paper.categories,
          topicName: paper.topicName,
        },
      }),
    });

    if (!response.ok) {
      const payload = await safeReadJson(response);
      throw new Error(payload.error || `API returned ${response.status}`);
    }

    const payload = await response.json();
    if (!payload.aiSummary) {
      throw new Error("API 没有返回总结内容");
    }

    attachSummary(paper, payload.aiSummary);
  } catch (error) {
    const message =
      location.hostname.endsWith("github.io") && !window.PAPER_PULSE_API_BASE
        ? "GitHub Pages 没有后端 API。请部署到 Vercel 或设置 PAPER_PULSE_API_BASE 后再使用实时总结。"
        : error.message;
    state.summaryErrors.set(paper.id, message);
  } finally {
    state.summarizing.delete(paper.id);
    render();
  }
}

function attachSummary(paper, aiSummary) {
  state.summaryCache[paper.arxivId] = aiSummary;
  localStorage.setItem("paperPulse.aiSummaries", JSON.stringify(state.summaryCache));
  state.papers = state.papers.map((item) =>
    item.id === paper.id ? { ...item, aiSummary } : item,
  );
}

function getApiBase() {
  const base = window.PAPER_PULSE_API_BASE || "";
  if (!base || base.endsWith("/")) return base;
  return `${base}/`;
}

async function safeReadJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
