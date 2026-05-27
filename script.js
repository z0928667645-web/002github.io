const fields = {
  meetingName: document.querySelector("#meetingName"),
  meetingDate: document.querySelector("#meetingDate"),
  attendees: document.querySelector("#attendees"),
  meetingNotes: document.querySelector("#meetingNotes"),
  formalMode: document.querySelector("#formalMode"),
  output: document.querySelector("#markdownOutput"),
  saveState: document.querySelector("#saveState"),
  pointCount: document.querySelector("#pointCount"),
  decisionCount: document.querySelector("#decisionCount"),
  todoCount: document.querySelector("#todoCount"),
};

const sampleNotes = `今天討論新產品上市計畫。
行銷部負責廣告宣傳，設計部負責包裝設計，業務部負責通路洽談。
大家同意先採用線上預熱活動，再搭配實體通路曝光。
預計8月底完成準備工作，下次會議確認各部門執行進度。`;

const actionWords = [
  "負責",
  "完成",
  "處理",
  "追蹤",
  "確認",
  "提供",
  "提交",
  "更新",
  "洽談",
  "設計",
  "宣傳",
  "規劃",
  "整理",
  "通知",
];

const decisionWords = ["決議", "確定", "同意", "採用", "通過", "確認", "維持"];
const followWords = ["下次", "追蹤", "後續", "下週", "下個月", "回報", "檢視"];
const ownerPattern = /([\u4e00-\u9fa5A-Za-z0-9]{2,12}(?:部|組|課|處|中心|團隊|小組|經理|主任|PM|負責人|設計師|工程師|業務|行銷))/;
const deadlinePattern =
  /((?:\d{1,2}\/\d{1,2})|(?:\d{1,2}月\d{1,2}日)|(?:\d{1,2}月底)|(?:\d{1,2}月(?:底|前)?)|(?:本週|下週|月底|週五|週四|週三|週二|週一|今天|明天|後天|年底|季底)(?:前)?)/;

function splitSentences(text) {
  return text
    .replace(/\r/g, "")
    .split(/[\n。！？!?；;]+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitClauses(sentence) {
  return sentence
    .split(/[，,、]+/)
    .map((clause) => clause.trim())
    .filter(Boolean);
}

function cleanTask(sentence) {
  let task = sentence
    .replace(/^.*?負責/, "")
    .replace(/大家同意|決議|確定|預計|需|需要|請/g, "")
    .replace(deadlinePattern, "")
    .replace(ownerPattern, "")
    .replace(/[，,：:。]/g, " ")
    .trim();

  if (!task || task.length < 2) {
    task = sentence.replace(deadlinePattern, "").trim();
  }

  return task.length > 26 ? `${task.slice(0, 26)}...` : task;
}

function inferSummary(sentences) {
  if (!sentences.length) return "本次會議內容不足，尚無法產生摘要。";
  const topicSentence = sentences.find((sentence) => /討論|會議|計畫|專案|議題/.test(sentence)) || sentences[0];
  const summary = `本次會議主要${topicSentence.replace(/^今天|本次會議|會議中/g, "")}`;
  return summary.length > 100 ? `${summary.slice(0, 97)}...` : summary;
}

function uniqueList(items, fallback) {
  const cleaned = items.map((item) => item.trim()).filter(Boolean);
  const unique = [...new Set(cleaned)];
  return unique.length ? unique.slice(0, 5) : fallback;
}

function parseMeeting() {
  const text = fields.meetingNotes.value.trim();
  const sentences = splitSentences(text);
  const summary = inferSummary(sentences);

  const discussion = uniqueList(
    sentences.filter((sentence) => sentence.length >= 6),
    ["未提供足夠內容"]
  ).slice(0, 5);

  const clauses = sentences.flatMap(splitClauses);

  const decisions = uniqueList(
    clauses.filter((clause) =>
      decisionWords.some((word) => clause.includes(word)) || clause.includes("負責")
    ),
    ["未明確提及決議事項"]
  );

  const relatedDeadline = sentences.map((sentence) => sentence.match(deadlinePattern)?.[1]).find(Boolean);
  const actionClauses = clauses.filter((clause) =>
    actionWords.some((word) => clause.includes(word))
  );

  const todos = actionClauses.length
    ? actionClauses.map((clause) => {
        const owner = clause.match(ownerPattern)?.[1] || "未指定";
        const deadline = clause.match(deadlinePattern)?.[1] || relatedDeadline || "未指定";
        return {
          item: cleanTask(clause),
          owner,
          deadline,
        };
      })
    : [{ item: "未明確提及待辦事項", owner: "未指定", deadline: "未指定" }];

  const followUps = uniqueList(
    sentences.filter((sentence) => followWords.some((word) => sentence.includes(word))),
    ["確認待辦事項執行進度"]
  ).slice(0, 3);

  return { summary, discussion, decisions, todos, followUps };
}

function numbered(items) {
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function todoTable(todos) {
  return [
    "| 項目 | 負責人 | 期限 |",
    "|------|--------|------|",
    ...todos.map((todo) => `| ${todo.item} | ${todo.owner} | ${todo.deadline} |`),
  ].join("\n");
}

function buildMarkdown(data) {
  if (fields.formalMode.checked) {
    return `會議名稱：${fields.meetingName.value.trim() || "未指定"}

會議日期：${fields.meetingDate.value || "未指定"}

與會人員：${fields.attendees.value.trim() || "未指定"}

------------------------------------------------

一、會議摘要

${data.summary}

------------------------------------------------

二、討論重點

${numbered(data.discussion)}

------------------------------------------------

三、決議事項

${numbered(data.decisions)}

------------------------------------------------

四、待辦事項

${todoTable(data.todos)}

------------------------------------------------

五、下次追蹤事項

${data.followUps.map((item) => `- ${item}`).join("\n")}

------------------------------------------------

六、備註

-`;
  }

  return `【會議摘要】

${data.summary}

【討論重點】

${numbered(data.discussion)}

【決議事項】

${numbered(data.decisions)}

【待辦事項】

${todoTable(data.todos)}

【下次追蹤】

${data.followUps.map((item) => `- ${item}`).join("\n")}

【備註】

-`;
}

function updateCounts(data) {
  fields.pointCount.textContent = String(data.discussion.filter((item) => !item.includes("未提供")).length);
  fields.decisionCount.textContent = String(data.decisions.filter((item) => !item.includes("未明確")).length);
  fields.todoCount.textContent = String(data.todos.filter((todo) => !todo.item.includes("未明確")).length);
}

function organize() {
  const data = parseMeeting();
  const markdown = buildMarkdown(data);
  fields.output.textContent = markdown;
  updateCounts(data);
  fields.saveState.textContent = "已整理";
  localStorage.setItem("meetingMinutesDraft", JSON.stringify({
    meetingName: fields.meetingName.value,
    meetingDate: fields.meetingDate.value,
    attendees: fields.attendees.value,
    meetingNotes: fields.meetingNotes.value,
    formalMode: fields.formalMode.checked,
    output: markdown,
  }));
}

function loadDraft() {
  const rawDraft = localStorage.getItem("meetingMinutesDraft");
  if (!rawDraft) return;
  const draft = JSON.parse(rawDraft);
  fields.meetingName.value = draft.meetingName || "";
  fields.meetingDate.value = draft.meetingDate || "";
  fields.attendees.value = draft.attendees || "";
  fields.meetingNotes.value = draft.meetingNotes || "";
  fields.formalMode.checked = Boolean(draft.formalMode);
  if (draft.output) {
    fields.output.textContent = draft.output;
    updateCounts(parseMeeting());
    fields.saveState.textContent = "已載入草稿";
  }
}

document.querySelector("#meetingForm").addEventListener("submit", (event) => {
  event.preventDefault();
  organize();
});

document.querySelector("#sampleButton").addEventListener("click", () => {
  fields.meetingName.value = "新產品上市計畫會議";
  fields.meetingDate.value = "2026-05-27";
  fields.attendees.value = "行銷部、設計部、業務部";
  fields.meetingNotes.value = sampleNotes;
  organize();
});

document.querySelector("#clearButton").addEventListener("click", () => {
  fields.meetingName.value = "";
  fields.meetingDate.value = "";
  fields.attendees.value = "";
  fields.meetingNotes.value = "";
  fields.formalMode.checked = false;
  fields.output.textContent = "請先貼上會議內容，然後按下「整理會議紀錄」。";
  fields.pointCount.textContent = "0";
  fields.decisionCount.textContent = "0";
  fields.todoCount.textContent = "0";
  fields.saveState.textContent = "尚未整理";
  localStorage.removeItem("meetingMinutesDraft");
});

document.querySelector("#copyButton").addEventListener("click", async () => {
  await navigator.clipboard.writeText(fields.output.textContent);
  fields.saveState.textContent = "已複製";
});

document.querySelector("#downloadButton").addEventListener("click", () => {
  const blob = new Blob([fields.output.textContent], { type: "text/markdown;charset=utf-8" });
  const link = document.createElement("a");
  const fileName = fields.meetingName.value.trim() || "meeting-minutes";
  link.href = URL.createObjectURL(blob);
  link.download = `${fileName}.md`;
  link.click();
  URL.revokeObjectURL(link.href);
});

loadDraft();
