/**
 * One-time move of this browser's saved preferences from the old "sawmill." keys to
 * "timbertrail." (theme, language, sidebar, hidden table columns …). Imported first in
 * main.tsx so it runs before anything reads localStorage. Safe to run on every load.
 *
 * "sawmill.refresh" is not moved: api.ts reads it once as a legacy token and deletes it.
 */
const OLD = 'sawmill.';
const NEW = 'timbertrail.';
const SKIP = new Set(['sawmill.refresh']);

try {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(OLD) && !SKIP.has(k)) keys.push(k);
  }
  for (const k of keys) {
    const target = NEW + k.slice(OLD.length);
    const v = localStorage.getItem(k);
    if (v != null && localStorage.getItem(target) == null) localStorage.setItem(target, v);
    localStorage.removeItem(k);
  }
} catch {
  // storage blocked (private mode): nothing to move
}

export {};
