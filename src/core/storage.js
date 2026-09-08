export const STORAGE_KEY = "local-notes:items:v1";
export const SETTINGS_KEY = "local-notes:settings:v1";

export const DEFAULT_SETTINGS = Object.freeze({
  noteDateMode: "auto",
  todoGraceMinutes: 5,
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
    const todoGraceMinutes = Number.isFinite(Number(parsed.todoGraceMinutes))
      ? Math.min(1440, Math.max(0, Math.round(Number(parsed.todoGraceMinutes))))
      : DEFAULT_SETTINGS.todoGraceMinutes;
    return {
      noteDateMode,
      todoGraceMinutes: Number.isInteger(todoGraceMinutes)
        ? todoGraceMinutes
        : DEFAULT_SETTINGS.todoGraceMinutes,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeSettings(storage, settings) {
  storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
