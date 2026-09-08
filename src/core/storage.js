export const STORAGE_KEY = "local-notes:items:v1";

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
  let items = readItems(storage);
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
