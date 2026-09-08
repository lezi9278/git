import { CATEGORY_KEYS, CATEGORY_LABELS, categoryLabel } from "./core/categories.js";
import { createNote, filterNotes, sortNotes, updateNote } from "./core/notes.js";
import { listForRange, summarizeItems } from "./core/stats.js";
import {
  DEFAULT_SETTINGS,
  loadRepository,
  readSettings,
  writeSettings,
} from "./core/storage.js";
import { formatLocalDateTime, toDateKey } from "./core/time.js";
import {
  createTodo,
  purgeOverdueTodos,
  setTodoCompleted,
  sortTodos,
  updateTodo,
} from "./core/todos.js";
import { icon } from "./icons.js";

const storageBackend = window.localStorage;
const repository = loadRepository(storageBackend);
let appSettings = readSettings(storageBackend);

const initialQuery = new URLSearchParams(window.location.search);
const state = {
  view: ["notes", "todos", "mine"].includes(initialQuery.get("view"))
    ? initialQuery.get("view")
    : "notes",
  noteCategory: ["all", ...CATEGORY_KEYS].includes(initialQuery.get("category"))
    ? initialQuery.get("category")
    : "all",
  categoryMenuOpen: false,
  editorCategoryOpen: false,
  editor: null,
  returnView: { view: "notes", noteCategory: "all" },
  mineSection: ["creations", "settings"].includes(initialQuery.get("section"))
    ? initialQuery.get("section")
    : "creations",
  range: ["month", "all"].includes(initialQuery.get("range"))
    ? initialQuery.get("range")
    : "month",
};

const VIEW_NAMES = {
  notes: "笔记",
  todos: "待办",
  mine: "我的",
};

const topbar = document.querySelector("#topbar");
const pageTitle = document.querySelector("#page-title");
const pageSubtitle = document.querySelector("#page-subtitle");
const pageActions = document.querySelector("#page-actions");
const categoryPopover = document.querySelector("#category-popover");
const fab = document.querySelector("#fab");
const bottomTabs = document.querySelector("#bottom-tabs");
const content = document.querySelector("#content");
const toast = document.querySelector("#toast");
const confirmRoot = document.querySelector("#confirm-root");
const confirmTitle = document.querySelector("#confirm-title");
const confirmDetail = document.querySelector("#confirm-detail");
const confirmAction = document.querySelector("#confirm-action");
let pendingConfirm = null;
let toastTimer = null;

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character],
  );
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function noteFromEditor() {
  if (!state.editor || state.editor.kind !== "note" || !state.editor.id) {
    return null;
  }
  return repository
    .items()
    .find((item) => item.id === state.editor.id && item.kind === "note") ?? null;
}

function todoFromEditor() {
  if (!state.editor || state.editor.kind !== "todo" || !state.editor.id) {
    return null;
  }
  return repository
    .items()
    .find((item) => item.id === state.editor.id && item.kind === "todo") ?? null;
}

function activeNotes() {
  return sortNotes(filterNotes(repository.items(), state.noteCategory));
}

function allNoteCounts() {
  const notes = repository.items().filter((item) => item.kind === "note");
  const count = (category) => notes.filter((note) => note.category === category).length;
  return {
    all: notes.length,
    insight: count("insight"),
    life: count("life"),
    thinking: count("thinking"),
  };
}

function updateAppSettings(patch) {
  appSettings = { ...appSettings, ...patch };
  writeSettings(storageBackend, appSettings);
}

function noteDateForSave(existing, form) {
  if (appSettings.noteDateMode === "manual") {
    return form.elements.date.value;
  }
  return existing?.date || toDateKey(new Date());
}

function beginEditor(kind, mode, id = null) {
  state.editor = { kind, mode, id };
  state.categoryMenuOpen = false;
  state.editorCategoryOpen = false;
  state.returnView = {
    view: state.view,
    noteCategory: state.noteCategory,
    mineSection: state.mineSection,
    range: state.range,
  };
  render();
}

function closeEditor() {
  state.editor = null;
  state.categoryMenuOpen = false;
  state.editorCategoryOpen = false;
  const returnView = state.returnView;
  state.view = returnView?.view ?? "notes";
  state.noteCategory = returnView?.noteCategory ?? "all";
  state.mineSection = returnView?.mineSection ?? "creations";
  state.range = returnView?.range ?? "month";
  render();
}

function editorTitle() {
  if (!state.editor) {
    return "";
  }
  if (state.editor.kind === "note") {
    return state.editor.mode === "create" ? "新建笔记" : "编辑笔记";
  }
  return state.editor.mode === "create" ? "新建待办" : "编辑待办";
}

function wordCount(value) {
  return String(value ?? "").replace(/\s/g, "").length;
}

function compactDateTime(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function categoryOptionMarkup() {
  const category = noteFromEditor()?.category ?? "";
  return CATEGORY_KEYS.map(
    (key) => `
      <button
        class="menu-item${category === key ? " is-active" : ""}"
        type="button"
        data-category-option="${key}"
        aria-pressed="${category === key}"
      >
        <span>${CATEGORY_LABELS[key]}</span>
        ${category === key ? icon("check", "menu-check", 15) : ""}
      </button>
    `,
  ).join("");
}

function noteFormMarkup() {
  const note = noteFromEditor();
  const title = note?.title ?? "";
  const contentValue = note?.content ?? "";
  const category = note?.category ?? "";
  const date = note?.date ?? toDateKey(new Date());
  const dateField =
    appSettings.noteDateMode === "manual"
      ? `<div class="field note-date-field" data-testid="note-date-field">
          <label for="note-date">日期</label>
          <input id="note-date" name="date" type="date" value="${escapeAttribute(date)}" />
        </div>`
      : "";

  return `
    <form class="editor-page-form" data-testid="note-editor-page" data-form="note-editor">
      <input type="hidden" name="category" value="${escapeAttribute(category)}" />
      <div class="editor-toolbar">
        <button class="icon-tool" type="button" data-action="cancel-editor" aria-label="返回">${icon("arrowLeft")}</button>
        <div class="toolbar-spacer"></div>
        <button class="icon-tool save-tool" type="submit" aria-label="保存">${icon("check", "", 22)}</button>
      </div>
      <div class="editor-main">
        <input id="note-title" name="title" class="title-input" type="text" value="${escapeAttribute(title)}" placeholder="标题" autocomplete="off" aria-label="笔记标题" />
        <div class="note-meta-line">
          <span>${escapeHtml(compactDateTime(note?.createdAt ?? new Date().toISOString()))}</span>
          <span>|</span>
          <span data-word-count>${wordCount(contentValue)}字</span>
          <span>|</span>
          <button class="meta-category" type="button" data-action="toggle-editor-category">
            <span class="category-name">${category ? categoryLabel(category) : "未分类"}</span>${icon("chevronDown", "tiny-chevron", 13)}
          </button>
        </div>
        <div class="small-menu" data-testid="editor-category-menu" ${state.editorCategoryOpen ? "" : "hidden"}>${categoryOptionMarkup()}</div>
        <textarea id="note-content" name="content" placeholder="正文" spellcheck="false" aria-label="笔记内容">${escapeHtml(contentValue)}</textarea>
        ${dateField}
        <p class="error-text" data-form-errors aria-live="polite"></p>
      </div>
    </form>
  `;
}

function todoFormMarkup() {
  const todo = todoFromEditor();
  const text = todo?.text ?? "";
  const startAt = todo?.startAt ?? "";
  const endAt = todo?.endAt ?? "";
  return `
    <form class="editor-page-form" data-testid="todo-editor-page" data-form="todo-editor">
      <div class="editor-toolbar">
        <button class="icon-tool" type="button" data-action="cancel-editor" aria-label="返回">${icon("arrowLeft")}</button>
        <div class="toolbar-spacer"></div>
        <button class="icon-tool save-tool" type="submit" aria-label="保存">${icon("check", "", 22)}</button>
      </div>
      <div class="editor-main">
        <input id="todo-text" name="text" class="title-input" type="text" value="${escapeAttribute(text)}" placeholder="待办内容" autocomplete="off" />
        <div class="todo-time-fields">
          <label>
            <span>开始时间</span>
            <input name="startAt" type="datetime-local" step="60" value="${escapeAttribute(startAt)}" />
          </label>
          <label>
            <span>结束时间</span>
            <input name="endAt" type="datetime-local" step="60" value="${escapeAttribute(endAt)}" />
          </label>
        </div>
        <p class="error-text" data-form-errors aria-live="polite"></p>
      </div>
    </form>
  `;
}

function renderEditor() {
  if (!state.editor) {
    return "";
  }
  return `
    <div class="view editor-scroll view-enter" data-testid="editor-view">
      ${state.editor.kind === "note" ? noteFormMarkup() : todoFormMarkup()}
    </div>
  `;
}

function renderNotesView() {
  const notes = activeNotes();
  const rows = notes.length
    ? notes
        .map(
          (note) => `
            <article class="list-row" data-testid="note-item" data-note-id="${note.id}">
              <button class="row-main" type="button" data-action="open-note" data-id="${note.id}">
                <h2>${escapeHtml(note.title)}</h2>
                <p>${escapeHtml(note.content)}</p>
                <div class="row-meta">
                  <span>${escapeHtml(note.date)}</span>
                  <span>${categoryLabel(note.category)}</span>
                </div>
              </button>
              <button class="row-delete" type="button" data-action="delete-note" data-id="${note.id}" aria-label="删除笔记">${icon("trash", "", 17)}</button>
            </article>
          `,
        )
        .join("")
    : '<div class="empty-state">还没有笔记</div>';

  return `
    <div class="view plain-list-page view-enter" data-testid="notes-list-view">
      <div class="plain-list">${rows}</div>
    </div>
  `;
}

function timeRangeLabel(todo) {
  return `${formatLocalDateTime(todo.startAt)} 至 ${formatLocalDateTime(todo.endAt)}`;
}

function renderTodoRows() {
  const todos = sortTodos(
    repository
      .items()
      .filter((item) => item.kind === "todo"),
  );
  if (!todos.length) {
    return '<div class="empty-state">还没有待办</div>';
  }
  return todos
    .map(
      (todo) => `
        <article class="list-row todo-row${todo.completed ? " is-completed" : ""}" data-testid="todo-item" data-todo-id="${todo.id}">
          <button
            class="todo-check${todo.completed ? " is-done" : ""}"
            type="button"
            data-action="toggle-todo"
            data-id="${todo.id}"
            aria-label="${todo.completed ? "取消完成" : "标记完成"}"
          ></button>
          <button class="row-main" type="button" data-action="open-todo" data-id="${todo.id}">
            <span class="todo-text">${escapeHtml(todo.text)}</span>
            <time>${escapeHtml(formatLocalDateTime(todo.startAt))} 至 ${escapeHtml(formatLocalDateTime(todo.endAt))}</time>
          </button>
          <button class="row-delete" type="button" data-action="delete-todo" data-id="${todo.id}" aria-label="删除待办">${icon("trash", "", 17)}</button>
          <span class="status-foot ${todo.completed ? "done" : "open"}">${todo.completed ? "已完成" : "未完成"}</span>
        </article>
      `,
    )
    .join("");
}

function renderTodosView() {
  return `
    <div class="view plain-list-page view-enter" data-testid="todos-list-view">
      <div class="plain-list">${renderTodoRows()}</div>
    </div>
  `;
}

function itemSummary(item) {
  if (item.kind === "note") {
    return item.content;
  }
  return `${timeRangeLabel(item)} · ${item.completed ? "已完成" : "未完成"}`;
}

function itemDateLabel(item) {
  if (item.kind === "note") {
    return item.date;
  }
  return (item.startAt ?? item.endAt ?? "").slice(0, 10);
}

function renderMineView() {
  const tab = (section, label) =>
    `<button class="section-tab${state.mineSection === section ? " is-active" : ""}" type="button" data-action="mine-section" data-section="${section}">${label}</button>`;
  const settingsMarkup = `
    <div class="view mine-view view-enter" data-testid="mine-view">
      <div class="section-tabs">${tab("creations", "我的创作")}${tab("settings", "设置")}</div>
      <div class="settings-stack" data-testid="settings-view">
        <section class="settings-card">
          <div class="settings-card-head">
            <h2>时间设置</h2>
          </div>
          <div class="setting-row">
            <strong>笔记日期</strong>
            <div class="segmented-control">
              <button class="${appSettings.noteDateMode === "auto" ? "is-active" : ""}" type="button" data-action="note-date-mode" data-mode="auto">自动</button>
              <button class="${appSettings.noteDateMode === "manual" ? "is-active" : ""}" type="button" data-action="note-date-mode" data-mode="manual">手动</button>
            </div>
          </div>
          <form class="setting-row" data-form="settings-grace">
            <strong>待办过期等待</strong>
            <div class="grace-field">
              <input name="todoGraceMinutes" type="number" min="0" max="1440" step="1" value="${appSettings.todoGraceMinutes}" />
              <span>分钟</span>
              <button class="button small-button" type="submit">保存</button>
            </div>
          </form>
        </section>
        <section class="settings-card">
          <div class="settings-card-head">
            <h2>版本说明</h2>
            <span>第二版</span>
          </div>
          <ul class="version-list">
            <li>新增：笔记和待办采用独立的新建与编辑页面。</li>
            <li>新增：待办支持开始时间与结束时间。</li>
            <li>新增：时间设置与版本说明页面。</li>
            <li>修改：笔记日期改为自动获取，可在设置中选择手动填写。</li>
            <li>修改：待办过期清理时间调整为结束后 5 分钟。</li>
            <li>修改：整体视觉与交互动效更新。</li>
          </ul>
        </section>
      </div>
    </div>
  `;

  if (state.mineSection === "settings") {
    return settingsMarkup;
  }

  const records = listForRange(repository.items(), state.range);
  const stats = summarizeItems(records);
  const rangeName = state.range === "month" ? "本月创作" : "全部创作";
  const rows = records.length
    ? records
        .map(
          (item) => `
            <button class="timeline-item" type="button" data-action="open-content" data-id="${item.id}" data-kind="${item.kind}">
              <span class="timeline-type ${item.kind}">${item.kind === "note" ? "笔记" : "待办"}</span>
              <span class="timeline-copy">
                <strong>${escapeHtml(item.title ?? item.text)}</strong>
                <span class="timeline-summary">${escapeHtml(itemSummary(item))}</span>
              </span>
              <span class="timeline-date">${escapeHtml(itemDateLabel(item))}</span>
            </button>
          `,
        )
        .join("")
    : '<div class="empty-state soft">当前范围没有内容</div>';

  return `
    <div class="view mine-view view-enter" data-testid="mine-view">
      <div class="section-tabs">${tab("creations", "我的创作")}${tab("settings", "设置")}</div>
      <div class="range-row">
        <button class="range-button${state.range === "month" ? " is-active" : ""}" type="button" data-action="set-range" data-range="month">本月创作</button>
        <button class="range-button${state.range === "all" ? " is-active" : ""}" type="button" data-action="set-range" data-range="all">全部创作</button>
      </div>
      <div class="stats-row">
        <div class="stat-card" data-testid="stat-total">
          <span class="stat-value">${stats.total}</span>
          <span class="stat-label">总内容</span>
        </div>
        <div class="stat-card" data-testid="stat-notes">
          <span class="stat-value">${stats.notes}</span>
          <span class="stat-label">笔记</span>
        </div>
        <div class="stat-card" data-testid="stat-todos">
          <span class="stat-value">${stats.todos}</span>
          <span class="stat-label">待办</span>
        </div>
      </div>
      <section class="timeline-pane">
        <div class="list-heading">
          <h2>${rangeName}</h2>
          <span class="count-badge">${records.length}</span>
        </div>
        <div class="scroll-list">${rows}</div>
      </section>
    </div>
  `;
}

function titleCategoryName(category) {
  return category === "all" ? "全部" : CATEGORY_LABELS[category] ?? "全部";
}

function renderTopbar() {
  const composing = Boolean(state.editor);
  topbar.hidden = composing;
  pageActions.innerHTML = "";
  if (composing) {
    return;
  }
  if (state.view === "notes") {
    const notes = repository.items().filter((item) => item.kind === "note");
    const counts = allNoteCounts();
    pageTitle.innerHTML = `
      <button class="title-dropdown" type="button" data-action="category-menu" aria-expanded="${state.categoryMenuOpen}">
        <span>${titleCategoryName(state.noteCategory)}</span>
        ${icon("chevronDown", "title-chevron", 16)}
      </button>
    `;
    pageSubtitle.textContent = `${notes.length} 篇笔记`;
    const categories = [
      { key: "all", label: "全部", count: counts.all },
      ...CATEGORY_KEYS.map((key) => ({
        key,
        label: CATEGORY_LABELS[key],
        count: counts[key],
      })),
    ];
    categoryPopover.innerHTML = categories
      .map(
        (category) => `
          <button
            class="menu-item${state.noteCategory === category.key ? " is-active" : ""}"
            type="button"
            data-category-filter="${category.key}"
            aria-pressed="${state.noteCategory === category.key}"
          >
            <span>${category.label}</span>
            <small>${category.count}</small>
            ${state.noteCategory === category.key ? icon("check", "menu-check", 15) : ""}
          </button>
        `,
      )
      .join("");
    categoryPopover.hidden = !state.categoryMenuOpen;
    return;
  }

  const count =
    state.view === "todos"
      ? repository.items().filter((item) => item.kind === "todo").length
      : 0;
  pageTitle.textContent = VIEW_NAMES[state.view];
  pageSubtitle.textContent =
    state.view === "todos"
      ? `${count} 条待办`
      : state.mineSection === "settings"
        ? "偏好设置"
        : "创作记录";
  categoryPopover.hidden = true;
}

function renderFab() {
  const showFab = !state.editor && (state.view === "notes" || state.view === "todos");
  fab.hidden = !showFab;
  if (!showFab) {
    return;
  }
  const action = state.view === "notes" ? "new-note" : "new-todo";
  fab.dataset.action = action;
  fab.setAttribute("aria-label", state.view === "notes" ? "新建笔记" : "新建待办");
  fab.innerHTML = icon("plus", "", 28);
}

function renderBottomTabs() {
  const tabs = [
    { view: "notes", label: "笔记", iconName: "fileText" },
    { view: "todos", label: "待办", iconName: "listChecks" },
    { view: "mine", label: "我的", iconName: "user" },
  ];
  bottomTabs.innerHTML = tabs
    .map(
      (tab) => `
        <button
          class="tab-item${state.view === tab.view ? " is-active" : ""}"
          type="button"
          data-view="${tab.view}"
          ${state.view === tab.view ? 'aria-current="page"' : ""}
        >
          <span class="tab-icon">${icon(tab.iconName, "", 21)}</span>
          <span>${tab.label}</span>
        </button>
      `,
    )
    .join("");
}

function render() {
  const composing = Boolean(state.editor);
  renderTopbar();
  renderFab();
  renderBottomTabs();
  content.innerHTML = composing
    ? renderEditor()
    : state.view === "notes"
      ? renderNotesView()
      : state.view === "todos"
        ? renderTodosView()
        : renderMineView();
  document.body.classList.toggle("is-composing", composing);
  updateNavigation();
  syncLocation();
}

function syncLocation() {
  const params = new URLSearchParams();
  if (state.view !== "notes") {
    params.set("view", state.view);
  }
  if (state.noteCategory !== "all") {
    params.set("category", state.noteCategory);
  }
  if (state.mineSection !== "creations") {
    params.set("section", state.mineSection);
  }
  if (state.range !== "month") {
    params.set("range", state.range);
  }
  const query = params.toString();
  history.replaceState(null, "", query ? `${location.pathname}?${query}` : location.pathname);
}

function updateNavigation() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    if (button.dataset.view === state.view) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 2400);
}

function showConfirm({ title, detail, actionLabel }, onConfirm) {
  confirmTitle.textContent = title;
  confirmDetail.textContent = detail;
  confirmAction.textContent = actionLabel;
  pendingConfirm = onConfirm;
  confirmRoot.hidden = false;
}

function closeConfirm() {
  pendingConfirm = null;
  confirmRoot.hidden = true;
}

function deleteNote(id) {
  const note = repository.items().find((item) => item.id === id && item.kind === "note");
  if (!note) {
    return;
  }
  showConfirm(
    {
      title: "删除笔记",
      detail: `将删除“${note.title}”，此操作无法恢复。`,
      actionLabel: "删除",
    },
    () => {
      repository.remove(id);
      render();
      showToast("笔记已删除");
    },
  );
}

function deleteTodo(id) {
  const todo = repository.items().find((item) => item.id === id && item.kind === "todo");
  if (!todo) {
    return;
  }
  showConfirm(
    {
      title: "删除待办",
      detail: `将删除“${todo.text}”，此操作无法恢复。`,
      actionLabel: "删除",
    },
    () => {
      repository.remove(id);
      render();
      showToast("待办已删除");
    },
  );
}

function saveNoteFromForm(form) {
  const existing = noteFromEditor();
  const draft = {
    title: form.elements.title.value,
    content: form.elements.content.value,
    category: form.elements.category.value,
    date: noteDateForSave(existing, form),
  };
  try {
    const saved = existing ? updateNote(existing, draft) : createNote(draft);
    repository.upsert(saved);
    state.noteCategory = saved.category;
    closeEditor();
    showToast(existing ? "笔记已更新" : "笔记已保存");
  } catch (error) {
    const errorElement = form.querySelector("[data-form-errors]");
    errorElement.textContent = error.validation?.join("；") ?? "保存失败，请检查填写内容";
  }
}

function saveTodoFromForm(form) {
  const existing = todoFromEditor();
  const draft = {
    text: form.elements.text.value,
    startAt: form.elements.startAt.value,
    endAt: form.elements.endAt.value,
  };
  try {
    const saved = existing ? updateTodo(existing, draft) : createTodo(draft);
    repository.upsert(saved);
    closeEditor();
    const removedCount = runOverdueCheck({ notify: false });
    if (removedCount > 0) {
      showToast(`已自动清理 ${removedCount} 条过期未完成待办`);
    } else {
      showToast(existing ? "待办已更新" : "待办已添加");
    }
  } catch (error) {
    const errorElement = form.querySelector("[data-form-errors]");
    errorElement.textContent = error.validation?.join("；") ?? "保存失败，请检查填写内容";
  }
}

function toggleTodo(id) {
  const todo = repository.items().find((item) => item.id === id && item.kind === "todo");
  if (!todo) {
    return;
  }
  const updated = setTodoCompleted(todo, !todo.completed);
  repository.upsert(updated);
  render();
  showToast(updated.completed ? "已标记完成" : "已取消完成");
}

function runOverdueCheck({ notify = true } = {}) {
  const result = purgeOverdueTodos(
    repository.items(),
    new Date(),
    appSettings.todoGraceMinutes,
  );
  if (!result.removed.length) {
    return 0;
  }
  repository.replace(result.remaining);
  render();
  if (notify) {
    showToast(`已自动清理 ${result.removed.length} 条过期未完成待办`);
  }
  return result.removed.length;
}

function openContentItem(id) {
  const item = repository.items().find((candidate) => candidate.id === id);
  if (!item) {
    return;
  }
  beginEditor(item.kind, "edit", item.id);
}

function selectView(view) {
  if (!VIEW_NAMES[view]) {
    return;
  }
  state.editor = null;
  state.categoryMenuOpen = false;
  state.view = view;
  render();
}

document.addEventListener("click", (event) => {
  const navButton = event.target.closest("[data-view]");
  if (navButton) {
    selectView(navButton.dataset.view);
    return;
  }

  const categoryOption = event.target.closest("[data-category-option]");
  if (categoryOption) {
    document.querySelectorAll("[data-category-option]").forEach((button) => {
      const selected = button === categoryOption;
      button.setAttribute("aria-pressed", String(selected));
      button.classList.toggle("is-selected", selected);
    });
    const hiddenInput = document.querySelector('input[name="category"]');
    if (hiddenInput) {
      hiddenInput.value = categoryOption.dataset.categoryOption;
    }
    const nameElement = document.querySelector(".category-name");
    if (nameElement) {
      nameElement.textContent = categoryLabel(categoryOption.dataset.categoryOption);
    }
    const menu = document.querySelector(".small-menu");
    if (menu) {
      menu.hidden = true;
    }
    state.editorCategoryOpen = false;
    state.categoryMenuOpen = false;
    return;
  }

  const categoryFilter = event.target.closest("[data-category-filter]");
  if (categoryFilter) {
    state.noteCategory = categoryFilter.dataset.categoryFilter;
    state.categoryMenuOpen = false;
    render();
    return;
  }

  const actionElement = event.target.closest("[data-action]");
  if (!actionElement) {
    return;
  }
  const action = actionElement.dataset.action;
  const id = actionElement.dataset.id;
  if (action === "new-note") {
    beginEditor("note", "create");
  } else if (action === "new-todo") {
    beginEditor("todo", "create");
  } else if (action === "open-note" || action === "edit-note") {
    beginEditor("note", "edit", id);
  } else if (action === "open-todo" || action === "edit-todo") {
    beginEditor("todo", "edit", id);
  } else if (action === "delete-note") {
    deleteNote(id);
  } else if (action === "delete-todo") {
    deleteTodo(id);
  } else if (action === "toggle-todo") {
    toggleTodo(id);
  } else if (action === "cancel-editor") {
    closeEditor();
  } else if (action === "category-menu") {
    state.categoryMenuOpen = !state.categoryMenuOpen;
    render();
    return;
  } else if (action === "toggle-editor-category") {
    const menu = document.querySelector(".small-menu");
    if (menu) {
      menu.hidden = !menu.hidden;
      state.editorCategoryOpen = !menu.hidden;
    }
    return;
  } else if (action === "mine-section") {
    state.mineSection = actionElement.dataset.section;
    render();
  } else if (action === "set-range") {
    state.range = actionElement.dataset.range;
    render();
  } else if (action === "open-content") {
    openContentItem(id);
  } else if (action === "note-date-mode") {
    const mode = actionElement.dataset.mode;
    updateAppSettings({ noteDateMode: mode === "manual" ? "manual" : "auto" });
    render();
    showToast(mode === "manual" ? "笔记日期已改为手动填写" : "笔记日期已改为自动获取");
  } else if (action === "close-confirm") {
    closeConfirm();
  }

  if (state.categoryMenuOpen && !event.target.closest(".title-block")) {
    state.categoryMenuOpen = false;
    render();
  }
});

document.addEventListener("submit", (event) => {
  const noteForm = event.target.closest("[data-form='note-editor']");
  if (noteForm) {
    event.preventDefault();
    saveNoteFromForm(noteForm);
    return;
  }
  const todoForm = event.target.closest("[data-form='todo-editor']");
  if (todoForm) {
    event.preventDefault();
    saveTodoFromForm(todoForm);
    return;
  }
  const graceForm = event.target.closest("[data-form='settings-grace']");
  if (graceForm) {
    event.preventDefault();
    const minutes = Math.min(
      1440,
      Math.max(0, Math.round(Number(graceForm.elements.todoGraceMinutes.value))),
    );
    updateAppSettings({ todoGraceMinutes: minutes });
    render();
    showToast(`待办过期等待已设为 ${minutes} 分钟`);
  }
});

document.addEventListener("input", (event) => {
  const textarea = event.target.closest('textarea[name="content"]');
  if (!textarea) {
    return;
  }
  const counter = document.querySelector("[data-word-count]");
  if (counter) {
    counter.textContent = `${wordCount(textarea.value)}字`;
  }
});

confirmAction.addEventListener("click", () => {
  if (pendingConfirm) {
    pendingConfirm();
  }
  closeConfirm();
});

confirmRoot.addEventListener("click", (event) => {
  if (event.target === confirmRoot) {
    closeConfirm();
  }
});

render();
runOverdueCheck();
setInterval(() => {
  runOverdueCheck();
}, 30000);
