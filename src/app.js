import { CATEGORY_KEYS, CATEGORY_LABELS, categoryLabel } from "./core/categories.js";
import { createNote, filterNotes, sortNotes, updateNote } from "./core/notes.js";
import { loadRepository } from "./core/storage.js";

const repository = loadRepository(window.localStorage);

const state = {
  view: "notes",
  noteCategory: "all",
  selectedNoteId: null,
  todoEditingId: null,
  mineSection: "creations",
  range: "month",
};

const pageTitle = document.querySelector("#page-title");
const pageActions = document.querySelector("#page-actions");
const content = document.querySelector("#content");
const toast = document.querySelector("#toast");
const confirmRoot = document.querySelector("#confirm-root");
const confirmTitle = document.querySelector("#confirm-title");
const confirmDetail = document.querySelector("#confirm-detail");
const confirmAction = document.querySelector("#confirm-action");
let pendingConfirm = null;
let toastTimer = null;

const VIEW_NAMES = {
  notes: "笔记",
  todos: "待办",
  mine: "我的",
};

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

function noteFromState() {
  if (!state.selectedNoteId) {
    return null;
  }
  return repository
    .items()
    .find((item) => item.id === state.selectedNoteId && item.kind === "note") ?? null;
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

function noteFormMarkup(note) {
  const isEditing = Boolean(note);
  const title = note?.title ?? "";
  const contentValue = note?.content ?? "";
  const category = note?.category ?? "";
  const date = note?.date ?? "";
  const choices = CATEGORY_KEYS.map(
    (key) =>
      `<button type="button" class="choice${category === key ? " selected" : ""}" data-category-option="${key}" aria-pressed="${category === key}">${CATEGORY_LABELS[key]}</button>`,
  ).join("");

  return `
    <form class="note-form" data-testid="note-editor" data-form="note-editor">
      <div class="editor-head">
        <h2 data-testid="editor-title">${isEditing ? "编辑笔记" : "新建笔记"}</h2>
      </div>
      <div class="form-body">
        <input type="hidden" name="category" value="${escapeAttribute(category)}" />
        <div class="field">
          <label for="note-title">标题</label>
          <input id="note-title" name="title" type="text" value="${escapeAttribute(title)}" autocomplete="off" />
        </div>
        <div class="field">
          <label for="note-content">内容</label>
          <textarea id="note-content" name="content" spellcheck="false">${escapeHtml(contentValue)}</textarea>
        </div>
        <div class="field">
          <span>分类</span>
          <div class="choice-row">${choices}</div>
        </div>
        <div class="field">
          <label for="note-date">日期</label>
          <input id="note-date" name="date" type="date" value="${escapeAttribute(date)}" />
        </div>
        <p class="error-text" data-form-errors aria-live="polite"></p>
      </div>
      <div class="form-actions">
        <button class="button" type="button" data-action="cancel-note">清空</button>
        <button class="button primary" type="submit">保存笔记</button>
      </div>
    </form>
  `;
}

function renderNotesView() {
  const notes = activeNotes();
  const counts = allNoteCounts();
  const categories = [
    { key: "all", label: "全部", count: counts.all },
    ...CATEGORY_KEYS.map((key) => ({
      key,
      label: CATEGORY_LABELS[key],
      count: counts[key],
    })),
  ];
  const chips = categories
    .map(
      (category) =>
        `<button type="button" class="filter-chip${state.noteCategory === category.key ? "" : ""}" data-category-filter="${category.key}" aria-pressed="${state.noteCategory === category.key}">${category.label}<span class="count">${category.count}</span></button>`,
    )
    .join("");

  const list = notes.length
    ? notes
        .map(
          (note) => `
          <article class="note-item" data-testid="note-item" data-note-id="${note.id}">
            <button class="note-summary" type="button" data-action="open-note" data-id="${note.id}">
              <h3>${escapeHtml(note.title)}</h3>
              <p>${escapeHtml(note.content)}</p>
              <div class="note-meta">
                <span class="tag ${escapeAttribute(note.category)}">${categoryLabel(note.category)}</span>
                <time datetime="${escapeAttribute(note.date)}">${escapeHtml(note.date)}</time>
              </div>
            </button>
            <button class="icon-button" type="button" data-action="delete-note" data-id="${note.id}" aria-label="删除这篇笔记">删</button>
          </article>
        `,
        )
        .join("")
    : '<div class="empty-state">还没有笔记</div>';

  return `
    <div class="view" data-testid="notes-view">
      <div class="notes-layout">
        <section class="surface-pane">
          <div class="category-bar">${chips}</div>
          <div class="scroll-list">${list}</div>
        </section>
        <section class="surface-pane editor-pane">${noteFormMarkup(noteFromState())}</section>
      </div>
    </div>
  `;
}

function placeholderMarkup(label) {
  return `<div class="view placeholder-view" data-testid="${label}-placeholder">${label}将在后续阶段加入</div>`;
}

function render() {
  const viewName = VIEW_NAMES[state.view];
  pageTitle.textContent = viewName;
  pageActions.innerHTML =
    state.view === "notes"
      ? '<button class="button primary" type="button" data-action="new-note">新建笔记</button>'
      : "";
  content.innerHTML =
    state.view === "notes"
      ? renderNotesView()
      : state.view === "todos"
        ? placeholderMarkup("待办")
        : placeholderMarkup("我的");
  updateNavigation();
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
  }, 2200);
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
      if (state.selectedNoteId === id) {
        state.selectedNoteId = null;
      }
      render();
      showToast("笔记已删除");
    },
  );
}

function saveNoteFromForm(form) {
  const draft = {
    title: form.elements.title.value,
    content: form.elements.content.value,
    category: form.elements.category.value,
    date: form.elements.date.value,
  };
  try {
    const existing = noteFromState();
    const saved = existing ? updateNote(existing, draft) : createNote(draft);
    repository.upsert(saved);
    state.selectedNoteId = saved.id;
    state.noteCategory = saved.category;
    render();
    showToast(existing ? "笔记已更新" : "笔记已保存");
  } catch (error) {
    const errorElement = form.querySelector("[data-form-errors]");
    errorElement.textContent = error.validation?.join("；") ?? "保存失败，请检查填写内容";
  }
}

function selectCategory(category) {
  state.noteCategory = category;
  state.selectedNoteId = null;
  render();
}

function selectView(view) {
  if (!VIEW_NAMES[view]) {
    return;
  }
  state.view = view;
  render();
}

document.addEventListener("click", (event) => {
  const navButton = event.target.closest("[data-view]");
  if (navButton) {
    selectView(navButton.dataset.view);
    return;
  }

  const actionElement = event.target.closest("[data-action]");
  if (actionElement) {
    const action = actionElement.dataset.action;
    const id = actionElement.dataset.id;
    if (action === "new-note") {
      state.selectedNoteId = null;
      render();
    } else if (action === "open-note" || action === "edit-note") {
      state.selectedNoteId = id;
      render();
    } else if (action === "delete-note") {
      deleteNote(id);
    } else if (action === "cancel-note") {
      state.selectedNoteId = null;
      render();
    } else if (action === "close-confirm") {
      closeConfirm();
    }
    return;
  }

  const categoryFilter = event.target.closest("[data-category-filter]");
  if (categoryFilter) {
    selectCategory(categoryFilter.dataset.categoryFilter);
    return;
  }

  const categoryOption = event.target.closest("[data-category-option]");
  if (categoryOption) {
    document.querySelectorAll("[data-category-option]").forEach((button) => {
      const selected = button === categoryOption;
      button.setAttribute("aria-pressed", String(selected));
      button.classList.toggle("selected", selected);
    });
    const hiddenInput = document.querySelector('input[name="category"]');
    if (hiddenInput) {
      hiddenInput.value = categoryOption.dataset.categoryOption;
    }
  }
});

document.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-form='note-editor']");
  if (!form) {
    return;
  }
  event.preventDefault();
  saveNoteFromForm(form);
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
