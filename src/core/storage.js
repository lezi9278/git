import { DEFAULT_NOTE_CATEGORIES, normalizeCategories } from "./categories.js";

export const STORAGE_KEY = "local-notes:items:v1";
export const SETTINGS_KEY = "local-notes:settings:v1";

export const EDITOR_FONT_FAMILIES = Object.freeze([
  "default",
  "songti",
  "heiti",
  "kaiti",
  "mono",
]);

export const EDITOR_COLORS = Object.freeze(["ink", "gray", "red", "green", "blue"]);

export const DEFAULT_SETTINGS = Object.freeze({
  noteDateMode: "auto",
  todoGraceMinutes: 5,
  theme: "light",
  noteCategories: DEFAULT_NOTE_CATEGORIES,
  editorFontFamily: "default",
  editorFontSize: 17,
  editorColor: "ink",
});

export function migrateItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }
  return items.map((item) => {
    if (item?.kind !== "todo") {
      return item;
    }
    if (typeof item.startAt === "string" && typeof item.endAt === "string") {
      return item;
    }
    const legacyDueAt = typeof item.dueAt === "string" ? item.dueAt : item.endAt ?? item.startAt;
    return {
      ...item,
      startAt: legacyDueAt,
      endAt: legacyDueAt,
      dueAt: undefined,
    };
  });
}

export function createMemoryBackend(initialValue = "") {
  let value = String(initialValue);
  return {
    getItem() {
      return value;
    },
    setItem(_key, nextValue) {
      value = String(nextValue);
    },
    removeItem() {
      value = "";
    },
    clear() {
      value = "";
    },
  };
}

export function readItems(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeItems(storage, items) {
  storage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function clearItems(storage) {
  storage.removeItem(STORAGE_KEY);
}

export function loadRepository(storage) {
  let items = migrateItems(readItems(storage));
  const persist = () => {
    writeItems(storage, items);
  };
  return {
    items: () => [...items],
    replace(nextItems) {
      items = Array.isArray(nextItems) ? [...nextItems] : [];
      persist();
    },
    upsert(item) {
      const index = items.findIndex((candidate) => candidate.id === item.id);
      if (index >= 0) {
        items[index] = item;
      } else {
        items.push(item);
      }
      persist();
    },
    remove(id) {
      items = items.filter((item) => item.id !== id);
      persist();
    },
  };
}

export function readSettings(storage) {
  try {
    const raw = storage.getItem(SETTINGS_KEY);
    if (!raw) {
      return { ...DEFAULT_SETTINGS };
    }
    const parsed = JSON.parse(raw);
    const noteDateMode = parsed.noteDateMode === "manual" ? "manual" : "auto";
    const theme = parsed.theme === "eye" ? "eye" : "light";
    const editorFontFamily = EDITOR_FONT_FAMILIES.includes(parsed.editorFontFamily)
      ? parsed.editorFontFamily
      : DEFAULT_SETTINGS.editorFontFamily;
    const rawEditorFontSize = Number(parsed.editorFontSize);
    const editorFontSize = Number.isFinite(rawEditorFontSize)
      ? Math.min(32, Math.max(12, Math.round(rawEditorFontSize)))
      : DEFAULT_SETTINGS.editorFontSize;
    const editorColor = EDITOR_COLORS.includes(parsed.editorColor)
      ? parsed.editorColor
      : DEFAULT_SETTINGS.editorColor;
    const todoGraceMinutes = Number.isFinite(Number(parsed.todoGraceMinutes))
      ? Math.min(1440, Math.max(0, Math.round(Number(parsed.todoGraceMinutes))))
      : DEFAULT_SETTINGS.todoGraceMinutes;
    return {
      noteDateMode,
      todoGraceMinutes: Number.isInteger(todoGraceMinutes)
        ? todoGraceMinutes
        : DEFAULT_SETTINGS.todoGraceMinutes,
      theme,
      noteCategories: normalizeCategories(parsed.noteCategories),
      editorFontFamily,
      editorFontSize,
      editorColor,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeSettings(storage, settings) {
  storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
