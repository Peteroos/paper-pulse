export function buildDigestEmail(subscription, payload) {
  const topics = payload.topics.filter((topic) => subscription.topicIds.includes(topic.id));
  const sections = topics.map((topic) => {
    const papers = payload.papers
      .filter((paper) => paper.topicId === topic.id)
      .sort((a, b) => Number(b.hotScore || 0) - Number(a.hotScore || 0))
      .slice(0, 5);

    return {
      topic,
      papers,
    };
  });

  return {
    subject: `Paper Pulse 今日论文：${topics.map((topic) => topic.shortName).join(" / ")}`,
    html: renderDigestHtml(sections),
  };
}

export async function sendDigestEmail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const from = process.env.RESEND_FROM || "Paper Pulse <onboarding@resend.dev>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend returned ${response.status}: ${text.slice(0, 180)}`);
  }

  return response.json();
}

function renderDigestHtml(sections) {
  const body = sections
    .map(({ topic, papers }) => {
      const items = papers
        .map(
          (paper) => `
            <li style="margin:0 0 14px;">
              <a href="${escapeHtml(paper.abstractUrl)}" style="color:#176b87;font-weight:700;text-decoration:none;">${escapeHtml(paper.title)}</a>
              <p style="margin:4px 0 0;color:#555;line-height:1.5;">${escapeHtml(truncate(paper.summary, 220))}</p>
            </li>
          `,
        )
        .join("");

      return `
        <section style="margin-bottom:28px;">
          <h2 style="font-size:18px;margin:0 0 12px;color:${topic.color};">${escapeHtml(topic.name)}</h2>
          <ol style="padding-left:20px;margin:0;">${items}</ol>
        </section>
      `;
    })
    .join("");

  return `
    <div style="font-family:Arial,'Noto Sans SC',sans-serif;max-width:720px;margin:0 auto;color:#191816;">
      <h1 style="font-size:26px;margin:0 0 8px;">Paper Pulse 今日论文</h1>
      <p style="margin:0 0 24px;color:#666;">按你订阅的方向整理，优先展示近期热门论文。</p>
      ${body}
      <p style="margin-top:28px;color:#777;font-size:12px;">你收到这封邮件是因为订阅了 Paper Pulse。</p>
    </div>
  `;
}

function truncate(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
