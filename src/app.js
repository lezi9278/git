import {
  CATEGORY_LABEL_MAX_LENGTH,
  categoryKeysOf,
  categoryLabelIn,
} from "./core/categories.js";
import { createNote, filterNotes, makeId, searchNotes, sortNotes, updateNote } from "./core/notes.js";
import { plainTextToRichHtml, sanitizeRichText, stripHtml } from "./core/richtext.js";
import { listForRange, summarizeItems } from "./core/stats.js";
import {
  DEFAULT_SETTINGS,
  EDITOR_COLORS,
  EDITOR_FONT_FAMILIES,
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

function currentCategoryKeys() {
  return categoryKeysOf(appSettings.noteCategories);
}

const initialQuery = new URLSearchParams(window.location.search);
const state = {
  view: ["notes", "todos", "mine"].includes(initialQuery.get("view"))
    ? initialQuery.get("view")
    : "notes",
  noteCategory: ["all", ...currentCategoryKeys()].includes(initialQuery.get("category"))
    ? initialQuery.get("category")
    : "all",
  noteSearchOpen: Boolean(initialQuery.get("q")),
  noteSearchQuery: initialQuery.get("q") ?? "",
  categoryMenuOpen: false,
  categoryEditingKey: null,
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

const FONT_STACKS = {
  default: "",
  songti: "Songti SC, SimSun, serif",
  heiti: "SimHei, Heiti SC, Microsoft YaHei, sans-serif",
  kaiti: "Kaiti SC, KaiTi, STKaiti, serif",
  mono: "ui-monospace, Consolas, monospace",
};

const FONT_FAMILY_LABELS = {
  default: "系统默认",
  songti: "宋体",
  heiti: "黑体",
  kaiti: "楷体",
  mono: "等宽",
};

const EDITOR_COLOR_VALUES = {
  ink: "var(--ink)",
  gray: "#6b6b6b",
  red: "#d33122",
  green: "#2e7d32",
  blue: "#1a56b0",
};

const COLOR_LABELS = {
  ink: "墨色",
  gray: "灰色",
  red: "红色",
  green: "绿色",
  blue: "蓝色",
};

const EDITOR_FONT_SIZES = [15, 17, 20, 24, 28];

const topbar = document.querySelector("#topbar");
const pageTitle = document.querySelector("#page-title");
const pageSubtitle = document.querySelector("#page-subtitle");
const pageActions = document.querySelector("#page-actions");
const categoryPopover = document.querySelector("#category-popover");
const searchBar = document.querySelector("#search-bar");
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
  return sortNotes(
    searchNotes(
      filterNotes(repository.items(), state.noteCategory, currentCategoryKeys()),
      state.noteSearchQuery,
    ),
  );
}

function notesSubtitleText() {
  const keyword = state.noteSearchQuery.trim();
  if (keyword) {
    return `找到 ${activeNotes().length} 篇笔记`;
  }
  return `${repository.items().filter((item) => item.kind === "note").length} 篇笔记`;
}

function allNoteCounts() {
  const notes = repository.items().filter((item) => item.kind === "note");
  const counts = { all: notes.length };
  for (const category of appSettings.noteCategories) {
    counts[category.key] = notes.filter((note) => note.category === category.key).length;
  }
  return counts;
}

function updateAppSettings(patch) {
  appSettings = { ...appSettings, ...patch };
  writeSettings(storageBackend, appSettings);
}

function applyTheme() {
  if (appSettings.theme === "eye") {
    document.body.dataset.theme = "eye";
  } else {
    delete document.body.dataset.theme;
  }
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
  return appSettings.noteCategories
    .map(
      (entry) => `
      <button
        class="menu-item${category === entry.key ? " is-active" : ""}"
        type="button"
        data-category-option="${entry.key}"
        aria-pressed="${category === entry.key}"
      >
        <span>${escapeHtml(entry.label)}</span>
        ${category === entry.key ? icon("check", "menu-check", 15) : ""}
      </button>
    `,
    )
    .join("");
}

function richContentForEditor(note) {
  if (!note) {
    return "";
  }
  return note.richText
    ? sanitizeRichText(note.content)
    : plainTextToRichHtml(note.content ?? "");
}

function notePreviewText(note) {
  const text = note.richText ? stripHtml(note.content) : String(note.content ?? "");
  return text.replace(/\s+/g, " ").trim();
}

function editorDefaultStyle() {
  const fontStack = FONT_STACKS[appSettings.editorFontFamily] ?? "";
  const color = EDITOR_COLOR_VALUES[appSettings.editorColor] ?? "var(--ink)";
  return `font-family: ${fontStack || "inherit"}; font-size: ${appSettings.editorFontSize}px; color: ${color};`;
}

function runEditorCommand(command) {
  const editor = document.querySelector('[data-testid="note-content-editor"]');
  if (!editor) {
    return;
  }
  try {
    document.execCommand("styleWithCSS", false, "true");
  } catch {
    // 旧浏览器忽略，命令仍可用默认标记方式执行
  }
  if (!document.execCommand(command, false, null)) {
    showToast("请先将光标放在正文中");
  }
}

function applyInlineFormat(kind, value) {
  const editor = document.querySelector('[data-testid="note-content-editor"]');
  if (!editor) {
    return;
  }
  const selection = window.getSelection();
  if (!selection.rangeCount || selection.isCollapsed || !editor.contains(selection.anchorNode)) {
    showToast("请先选中要调整的文字");
    return;
  }
  const range = selection.getRangeAt(0);
  const fragment = range.extractContents();
  const wrapper = document.createElement("span");
  if (kind === "size") {
    wrapper.style.fontSize = `${Number.parseInt(value, 10) || 17}px`;
  } else if (kind === "family") {
    const fontStack = FONT_STACKS[value];
    if (fontStack) {
      wrapper.style.fontFamily = fontStack;
    }
  } else if (kind === "color") {
    const colorValue = EDITOR_COLOR_VALUES[value];
    if (colorValue) {
      wrapper.style.color = colorValue;
    }
  } else {
    return;
  }
  wrapper.appendChild(fragment);
  range.insertNode(wrapper);
  selection.removeAllRanges();
  hideFormatMenus();
}

function hideFormatMenus() {
  document.querySelectorAll(".format-menu").forEach((menu) => {
    menu.hidden = true;
  });
}

function formatBarMarkup() {
  const commandButtons = [
    ["bold", "bold", "加粗"],
    ["italic", "italic", "斜体"],
    ["underline", "underline", "下划线"],
  ];
  const alignButtons = [
    ["justifyLeft", "alignLeft", "左对齐"],
    ["justifyCenter", "alignCenter", "居中对齐"],
    ["justifyRight", "alignRight", "右对齐"],
  ];
  return `
    <div class="format-bar" data-testid="editor-format-bar">
      ${commandButtons
        .map(
          ([command, iconName, label]) =>
            `<button class="format-button" type="button" data-format-cmd="${command}" aria-label="${label}">${icon(iconName, "", 17)}</button>`,
        )
        .join("")}
      <button class="format-button" type="button" data-action="format-menu" data-menu="size" aria-label="字号">${icon("type", "", 17)}</button>
      <button class="format-button" type="button" data-action="format-menu" data-menu="family" aria-label="字体">${icon("baseline", "", 17)}</button>
      <button class="format-button" type="button" data-action="format-menu" data-menu="color" aria-label="颜色">${icon("droplet", "", 17)}</button>
      <span class="format-divider"></span>
      ${alignButtons
        .map(
          ([command, iconName, label]) =>
            `<button class="format-button" type="button" data-format-cmd="${command}" aria-label="${label}">${icon(iconName, "", 17)}</button>`,
        )
        .join("")}
      <div class="format-menu" data-format-menu="size" hidden>
        ${EDITOR_FONT_SIZES.map(
          (size) =>
            `<button class="size-option" type="button" data-format-apply="size" data-value="${size}">${size}</button>`,
        ).join("")}
      </div>
      <div class="format-menu is-column" data-format-menu="family" hidden>
        ${EDITOR_FONT_FAMILIES.map(
          (key) =>
            `<button class="menu-item" type="button" data-format-apply="family" data-value="${key}"><span>${FONT_FAMILY_LABELS[key]}</span></button>`,
        ).join("")}
      </div>
      <div class="format-menu" data-format-menu="color" hidden>
        ${EDITOR_COLORS.map(
          (key) =>
            `<button class="color-option" type="button" data-format-apply="color" data-value="${key}" aria-label="${COLOR_LABELS[key]}"><span class="color-dot" style="--dot: ${EDITOR_COLOR_VALUES[key]}"></span></button>`,
        ).join("")}
      </div>
    </div>
  `;
}

function noteFormMarkup() {
  const note = noteFromEditor();
  const title = note?.title ?? "";
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
          <span data-word-count>${wordCount(note ? notePreviewText(note) : "")}字</span>
          <span>|</span>
          <button class="meta-category" type="button" data-action="toggle-editor-category">
            <span class="category-name">${category ? escapeHtml(categoryLabelIn(appSettings.noteCategories, category)) : "未分类"}</span>${icon("chevronDown", "tiny-chevron", 13)}
          </button>
        </div>
        <div class="small-menu" data-testid="editor-category-menu" ${state.editorCategoryOpen ? "" : "hidden"}>${categoryOptionMarkup()}</div>
        <div class="rich-editor" name="content" data-testid="note-content-editor" contenteditable="true" data-placeholder="正文" spellcheck="false" aria-label="笔记内容" style="${escapeAttribute(editorDefaultStyle())}">${richContentForEditor(note)}</div>
        ${dateField}
        <p class="error-text" data-form-errors aria-live="polite"></p>
      </div>
      ${formatBarMarkup()}
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

function noteListRows() {
  const notes = activeNotes();
  if (!notes.length) {
    return state.noteSearchQuery.trim()
      ? '<div class="empty-state">没有匹配的笔记</div>'
      : '<div class="empty-state">还没有笔记</div>';
  }
  return notes
    .map(
      (note) => `
        <article class="list-row" data-testid="note-item" data-note-id="${note.id}">
          <button class="row-main" type="button" data-action="open-note" data-id="${note.id}">
            <h2>${escapeHtml(note.title)}</h2>
            <p>${escapeHtml(notePreviewText(note))}</p>
            <div class="row-meta">
              <span>${escapeHtml(note.date)}</span>
              <span>${escapeHtml(categoryLabelIn(appSettings.noteCategories, note.category))}</span>
            </div>
          </button>
          <button class="row-delete" type="button" data-action="delete-note" data-id="${note.id}" aria-label="删除笔记">${icon("trash", "", 17)}</button>
        </article>
      `,
    )
    .join("");
}

function renderNotesView() {
  return `
    <div class="view plain-list-page view-enter" data-testid="notes-list-view">
      <div class="plain-list">${noteListRows()}</div>
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
    return notePreviewText(item);
  }
  return `${timeRangeLabel(item)} · ${item.completed ? "已完成" : "未完成"}`;
}

function itemDateLabel(item) {
  if (item.kind === "note") {
    return item.date;
  }
  return (item.startAt ?? item.endAt ?? "").slice(0, 10);
}

function categorySettingsMarkup() {
  const rows = appSettings.noteCategories
    .map((category) => {
      if (state.categoryEditingKey === category.key) {
        return `
          <form class="category-row category-edit-form" data-form="category-rename" data-key="${category.key}">
            <input name="label" type="text" value="${escapeAttribute(category.label)}" maxlength="${CATEGORY_LABEL_MAX_LENGTH}" aria-label="分类名称" autocomplete="off" />
            <button class="button small-button" type="submit">保存</button>
            <button class="button small-button" type="button" data-action="cancel-category-rename">取消</button>
          </form>
        `;
      }
      return `
        <div class="category-row">
          <span class="category-row-name">${escapeHtml(category.label)}</span>
          <span class="category-row-actions">
            <button class="button small-button" type="button" data-action="rename-category" data-key="${category.key}">重命名</button>
            <button class="button small-button" type="button" data-action="delete-category" data-key="${category.key}">删除</button>
          </span>
        </div>
      `;
    })
    .join("");
  return `
    <section class="settings-card" data-testid="category-settings">
      <div class="settings-card-head">
        <h2>笔记分类</h2>
        <span>用于筛选与编辑</span>
      </div>
      <div class="category-list" data-testid="category-list">${rows}</div>
      <form class="category-add" data-form="category-add">
        <input name="label" type="text" placeholder="新分类名称" maxlength="${CATEGORY_LABEL_MAX_LENGTH}" aria-label="新分类名称" autocomplete="off" />
        <button class="button small-button" type="submit">添加</button>
      </form>
      <p class="error-text" data-category-errors aria-live="polite"></p>
    </section>
  `;
}

function renderMineView() {
  const tab = (section, label) =>
    `<button class="section-tab${state.mineSection === section ? " is-active" : ""}" type="button" data-action="mine-section" data-section="${section}">${label}</button>`;
  const settingsMarkup = `
    <div class="view mine-view view-enter" data-testid="mine-view">
      <div class="section-tabs">${tab("creations", "我的创作")}${tab("settings", "设置")}</div>
      <div class="settings-stack" data-testid="settings-view">
        <section class="settings-card" data-testid="appearance-settings">
          <div class="settings-card-head">
            <h2>外观设置</h2>
          </div>
          <div class="setting-row">
            <strong>显示模式</strong>
            <div class="segmented-control">
              <button class="${appSettings.theme === "light" ? "is-active" : ""}" type="button" data-action="theme-mode" data-mode="light">亮色</button>
              <button class="${appSettings.theme === "eye" ? "is-active" : ""}" type="button" data-action="theme-mode" data-mode="eye">护眼</button>
            </div>
          </div>
          <div class="setting-row">
            <strong>默认字体</strong>
            <select class="setting-select" name="editorFontFamily" aria-label="默认字体">
              ${EDITOR_FONT_FAMILIES.map(
                (key) =>
                  `<option value="${key}" ${appSettings.editorFontFamily === key ? "selected" : ""}>${FONT_FAMILY_LABELS[key]}</option>`,
              ).join("")}
            </select>
          </div>
          <div class="setting-row">
            <strong>默认字号</strong>
            <div class="segmented-control">
              ${[[15, "小"], [17, "中"], [20, "大"], [24, "特大"]]
                .map(
                  ([value, label]) =>
                    `<button class="${appSettings.editorFontSize === value ? "is-active" : ""}" type="button" data-action="editor-font-size" data-value="${value}">${label}</button>`,
                )
                .join("")}
            </div>
          </div>
          <div class="setting-row">
            <strong>默认颜色</strong>
            <div class="color-dot-row">
              ${EDITOR_COLORS.map(
                (key) =>
                  `<button class="color-dot${appSettings.editorColor === key ? " is-active" : ""}" type="button" data-action="editor-color" data-value="${key}" aria-label="${COLOR_LABELS[key]}" style="--dot: ${EDITOR_COLOR_VALUES[key]}"></button>`,
              ).join("")}
            </div>
          </div>
        </section>
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
        ${categorySettingsMarkup()}
        <section class="settings-card">
          <div class="settings-card-head">
            <h2>版本说明</h2>
            <span>第三版</span>
          </div>
          <ul class="version-list">
            <li>新增：外观设置，可开启护眼模式。</li>
            <li>新增：笔记支持按标题与正文搜索。</li>
            <li>新增：笔记支持自定义分类，可在设置中添加、重命名和删除分类。</li>
            <li>新增：编辑笔记支持加粗、斜体、下划线、字号、字体、颜色与对齐。</li>
            <li>新增：外观设置中可配置默认字体、字号与颜色。</li>
            <li>修改：应用更名为「乐乐笔记」。</li>
          </ul>
          <h3 class="version-subtitle">第二版</h3>
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
  return category === "all"
    ? "全部"
    : categoryLabelIn(appSettings.noteCategories, category);
}

function renderTopbar() {
  const composing = Boolean(state.editor);
  topbar.hidden = composing;
  pageActions.innerHTML = "";
  if (composing) {
    return;
  }
  if (state.view === "notes") {
    const counts = allNoteCounts();
    pageTitle.innerHTML = `
      <button class="title-dropdown" type="button" data-action="category-menu" aria-expanded="${state.categoryMenuOpen}">
        <span>${titleCategoryName(state.noteCategory)}</span>
        ${icon("chevronDown", "title-chevron", 16)}
      </button>
    `;
    pageSubtitle.textContent = notesSubtitleText();
    pageActions.innerHTML = `
      <button class="icon-tool" type="button" data-action="note-search-toggle" aria-label="${state.noteSearchOpen ? "关闭搜索" : "搜索笔记"}">${icon("search")}</button>
    `;
    searchBar.hidden = !state.noteSearchOpen;
    searchBar.innerHTML = state.noteSearchOpen
      ? `
        <input data-testid="note-search-input" name="note-search" type="text" value="${escapeAttribute(state.noteSearchQuery)}" placeholder="搜索标题或正文" autocomplete="off" aria-label="搜索笔记" />
        <button class="search-clear" type="button" data-action="note-search-clear" aria-label="清空搜索" ${state.noteSearchQuery.trim() ? "" : "hidden"}>${icon("close", "", 15)}</button>
      `
      : "";
    const categories = [
      { key: "all", label: "全部", count: counts.all },
      ...appSettings.noteCategories.map((category) => ({
        key: category.key,
        label: category.label,
        count: counts[category.key] ?? 0,
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
  searchBar.hidden = true;
  searchBar.innerHTML = "";
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
  applyTheme();
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
  const searchKeyword = state.noteSearchQuery.trim();
  if (searchKeyword) {
    params.set("q", searchKeyword);
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

function requestDeleteCategory(key) {
  const category = appSettings.noteCategories.find((entry) => entry.key === key);
  if (!category) {
    return;
  }
  if (appSettings.noteCategories.length <= 1) {
    showToast("至少保留一个分类");
    return;
  }
  const noteCount = repository
    .items()
    .filter((item) => item.kind === "note" && item.category === key).length;
  showConfirm(
    {
      title: "删除分类",
      detail:
        noteCount > 0
          ? `分类“${category.label}”下有 ${noteCount} 篇笔记，删除后这些笔记将显示为“未分类”。`
          : `将删除分类“${category.label}”。`,
      actionLabel: "删除",
    },
    () => {
      updateAppSettings({
        noteCategories: appSettings.noteCategories.filter((entry) => entry.key !== key),
      });
      if (state.categoryEditingKey === key) {
        state.categoryEditingKey = null;
      }
      if (state.noteCategory === key) {
        state.noteCategory = "all";
      }
      render();
      showToast("分类已删除");
    },
  );
}

function saveNoteFromForm(form) {
  const existing = noteFromEditor();
  const editorElement = form.querySelector('[data-testid="note-content-editor"]');
  const draft = {
    title: form.elements.title.value,
    content: editorElement ? editorElement.innerHTML : "",
    richText: true,
    category: form.elements.category.value,
    date: noteDateForSave(existing, form),
  };
  try {
    const saved = existing
      ? updateNote(existing, draft, new Date(), currentCategoryKeys())
      : createNote(draft, new Date(), currentCategoryKeys());
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
  state.noteSearchOpen = false;
  state.noteSearchQuery = "";
  state.categoryEditingKey = null;
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
      nameElement.textContent = categoryLabelIn(
        appSettings.noteCategories,
        categoryOption.dataset.categoryOption,
      );
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

  const formatApply = event.target.closest("[data-format-apply]");
  if (formatApply) {
    applyInlineFormat(formatApply.dataset.formatApply, formatApply.dataset.value);
    return;
  }

  const formatCommand = event.target.closest("[data-format-cmd]");
  if (formatCommand) {
    runEditorCommand(formatCommand.dataset.formatCmd);
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
  } else if (action === "theme-mode") {
    const mode = actionElement.dataset.mode === "eye" ? "eye" : "light";
    if (appSettings.theme !== mode) {
      updateAppSettings({ theme: mode });
      render();
      showToast(mode === "eye" ? "已开启护眼模式" : "已恢复亮色模式");
    }
  } else if (action === "note-search-toggle") {
    state.noteSearchOpen = !state.noteSearchOpen;
    state.noteSearchQuery = state.noteSearchOpen ? state.noteSearchQuery : "";
    render();
    if (state.noteSearchOpen) {
      searchBar.querySelector("input")?.focus();
    }
  } else if (action === "note-search-clear") {
    state.noteSearchQuery = "";
    const searchInput = searchBar.querySelector("input");
    if (searchInput) {
      searchInput.value = "";
    }
    const clearButton = searchBar.querySelector("[data-action='note-search-clear']");
    if (clearButton) {
      clearButton.hidden = true;
    }
    const list = content.querySelector(".plain-list");
    if (list) {
      list.innerHTML = noteListRows();
    }
    pageSubtitle.textContent = notesSubtitleText();
    syncLocation();
  } else if (action === "rename-category") {
    state.categoryEditingKey = actionElement.dataset.key;
    render();
  } else if (action === "cancel-category-rename") {
    state.categoryEditingKey = null;
    render();
  } else if (action === "delete-category") {
    requestDeleteCategory(actionElement.dataset.key);
  } else if (action === "format-menu") {
    const menuName = actionElement.dataset.menu;
    document.querySelectorAll(".format-menu").forEach((menu) => {
      menu.hidden = menu.dataset.formatMenu === menuName ? !menu.hidden : true;
    });
    return;
  } else if (action === "editor-font-size") {
    const size = Number.parseInt(actionElement.dataset.value, 10);
    if (Number.isFinite(size) && appSettings.editorFontSize !== size) {
      updateAppSettings({ editorFontSize: size });
      render();
      showToast(`默认字号已设为 ${size}px`);
    }
  } else if (action === "editor-color") {
    const color = actionElement.dataset.value;
    if (EDITOR_COLORS.includes(color) && appSettings.editorColor !== color) {
      updateAppSettings({ editorColor: color });
      render();
      showToast("默认颜色已更新");
    }
  } else if (action === "close-confirm") {
    closeConfirm();
  }

  if (state.categoryMenuOpen && !event.target.closest(".title-block")) {
    state.categoryMenuOpen = false;
    render();
  }
});

function validateCategoryLabel(label, { excludeKey = null } = {}) {
  if (!label) {
    return "分类名称不能为空";
  }
  if (label.length > CATEGORY_LABEL_MAX_LENGTH) {
    return `分类名称不能超过 ${CATEGORY_LABEL_MAX_LENGTH} 个字符`;
  }
  if (
    appSettings.noteCategories.some(
      (entry) => entry.key !== excludeKey && entry.label === label,
    )
  ) {
    return "分类名称已存在";
  }
  return "";
}

function clearCategoryError() {
  const errorElement = document.querySelector("[data-category-errors]");
  if (errorElement) {
    errorElement.textContent = "";
  }
}

function showCategoryError(message) {
  const errorElement = document.querySelector("[data-category-errors]");
  if (errorElement) {
    errorElement.textContent = message;
  }
}

document.addEventListener("mousedown", (event) => {
  if (event.target.closest(".format-bar")) {
    event.preventDefault();
  }
});

document.addEventListener("change", (event) => {
  const fontSelect = event.target.closest('select[name="editorFontFamily"]');
  if (!fontSelect) {
    return;
  }
  if (EDITOR_FONT_FAMILIES.includes(fontSelect.value)) {
    updateAppSettings({ editorFontFamily: fontSelect.value });
    render();
    showToast("默认字体已更新");
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
    return;
  }
  const categoryAddForm = event.target.closest("[data-form='category-add']");
  if (categoryAddForm) {
    event.preventDefault();
    const label = categoryAddForm.elements.label.value.trim();
    const error = validateCategoryLabel(label);
    if (error) {
      showCategoryError(error);
      return;
    }
    clearCategoryError();
    updateAppSettings({
      noteCategories: [
        ...appSettings.noteCategories,
        { key: makeId("cat"), label },
      ],
    });
    render();
    showToast(`已添加分类“${label}”`);
    return;
  }
  const categoryRenameForm = event.target.closest("[data-form='category-rename']");
  if (categoryRenameForm) {
    event.preventDefault();
    const key = categoryRenameForm.dataset.key;
    const label = categoryRenameForm.elements.label.value.trim();
    const error = validateCategoryLabel(label, { excludeKey: key });
    if (error) {
      showCategoryError(error);
      return;
    }
    clearCategoryError();
    updateAppSettings({
      noteCategories: appSettings.noteCategories.map((entry) =>
        entry.key === key ? { ...entry, label } : entry,
      ),
    });
    state.categoryEditingKey = null;
    render();
    showToast("分类已重命名");
  }
});

document.addEventListener("input", (event) => {
  const searchInput = event.target.closest('[data-testid="note-search-input"]');
  if (searchInput) {
    state.noteSearchQuery = searchInput.value;
    const list = content.querySelector(".plain-list");
    if (list) {
      list.innerHTML = noteListRows();
    }
    const clearButton = searchBar.querySelector("[data-action='note-search-clear']");
    if (clearButton) {
      clearButton.hidden = !state.noteSearchQuery.trim();
    }
    pageSubtitle.textContent = notesSubtitleText();
    syncLocation();
    return;
  }
  const editorElement = event.target.closest('[data-testid="note-content-editor"]');
  if (editorElement) {
    const counter = document.querySelector("[data-word-count]");
    if (counter) {
      counter.textContent = `${wordCount(editorElement.textContent)}字`;
    }
    return;
  }
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
