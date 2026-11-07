/**
 * «Never the same twice»: every game draws from a big pool and remembers on this device which
 * items the player has already seen. Unseen items always come first; only when the whole pool has
 * been played does it start over (and then in a new random order).
 */
const PREFIX = 'rq-seen:';

function read(key: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(PREFIX + key) ?? '[]') as string[]); } catch { return new Set(); }
}
function write(key: string, seen: Set<string>) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify([...seen])); } catch { /* storage full or blocked: repeats are fine */ }
}

function shuffled<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j]!, b[i]!]; }
  return b;
}

/** Picks `n` items for a round, unseen first, and marks them as seen. */
export function takeFresh<T>(key: string, pool: T[], n: number, id: (x: T) => string): T[] {
  if (!pool.length) return [];
  let seen = read(key);
  let fresh = pool.filter((x) => !seen.has(id(x)));
  if (fresh.length < n) {
    // the pool is used up: what is left now, then start a new cycle
    const rest = shuffled(fresh);
    seen = new Set();
    fresh = shuffled(pool.filter((x) => !rest.some((r) => id(r) === id(x))));
    const out = [...rest, ...fresh].slice(0, n);
    out.forEach((x) => seen.add(id(x)));
    write(key, seen);
    return out;
  }
  const out = shuffled(fresh).slice(0, n);
  out.forEach((x) => seen.add(id(x)));
  write(key, seen);
  return out;
}

/** How many of the pool this player has not met yet (for «yangi: N» hints). */
export function freshLeft<T>(key: string, pool: T[], id: (x: T) => string): number {
  const seen = read(key);
  return pool.filter((x) => !seen.has(id(x))).length;
}

/** Big pools live in /games/*.json and are fetched once, only when a game needs them. */
const cache = new Map<string, Promise<unknown>>();
export function loadPool<T>(name: string): Promise<T> {
  let p = cache.get(name);
  if (!p) {
    p = fetch(`/games/${name}.json`).then((r) => { if (!r.ok) throw new Error(`pool ${name}: ${r.status}`); return r.json(); });
    p.catch(() => cache.delete(name));
    cache.set(name, p);
  }
  return p as Promise<T>;
}

/** Whole pool in play order: unseen items first. Pair with `markSeen` when an item is actually used. */
export function orderFresh<T>(key: string, pool: T[], id: (x: T) => string): T[] {
  const seen = read(key);
  return [...shuffled(pool.filter((x) => !seen.has(id(x)))), ...shuffled(pool.filter((x) => seen.has(id(x))))];
}

/** Marks items as seen; once the whole pool (of `total` items) has been seen, the cycle starts over. */
export function markSeen(key: string, ids: string[], total: number) {
  const seen = read(key);
  ids.forEach((x) => seen.add(x));
  write(key, seen.size >= total ? new Set() : seen);
}
