// Память телефона (localStorage). Может быть недоступна (приватный режим и т.п.) — тогда сайт просто ничего не помнит.
const PREFIX = 'lototron:';

export function load(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch { return fallback; }
}

export function save(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* память недоступна */ }
}

export function remove(key) {
  try { localStorage.removeItem(PREFIX + key); } catch { /* память недоступна */ }
}
