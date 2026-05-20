import type { PropertyAnalysis } from "./types";

const KEY = "vastgoedai:history:v1";
const MAX = 30;
const TTL_MS = 24 * 60 * 60 * 1000;

function sameInput(a: string, b: string) {
  return a.trim().replace(/\/$/, "").toLowerCase() === b.trim().replace(/\/$/, "").toLowerCase();
}

function hasValidVraagprijs(a: PropertyAnalysis) {
  const prijs = a.listing?.vraagprijs ?? a.listing?.prijs;
  return typeof prijs === "number" && Number.isFinite(prijs) && prijs > 0;
}

function isCompleteEnoughForCache(a: PropertyAnalysis) {
  const isUrl = /^https?:\/\//i.test(a.input);
  return !isUrl || hasValidVraagprijs(a);
}

export function loadHistory(): PropertyAnalysis[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr: PropertyAnalysis[] = JSON.parse(raw);
    const clean = arr.filter(
      (a) => Date.now() - a.timestamp < TTL_MS && isCompleteEnoughForCache(a),
    );
    if (clean.length !== arr.length) localStorage.setItem(KEY, JSON.stringify(clean));
    return clean;
  } catch {
    return [];
  }
}

export function saveAnalysis(a: PropertyAnalysis) {
  if (typeof window === "undefined") return;
  if (!isCompleteEnoughForCache(a)) {
    const list = loadHistory().filter((x) => !sameInput(x.input, a.input));
    localStorage.setItem(KEY, JSON.stringify(list));
    return;
  }
  const safe: PropertyAnalysis = {
    ...a,
    listing: a.listing?.funda_debug
      ? { ...a.listing, funda_debug: { ...a.listing.funda_debug, raw_next_data: undefined } }
      : a.listing,
  };
  const list = loadHistory().filter((x) => x.id !== a.id && !sameInput(x.input, a.input));
  list.unshift(safe);
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
}

export function findCached(input: string): PropertyAnalysis | undefined {
  return loadHistory().find((a) => sameInput(a.input, input));
}

export function clearCachedInput(input: string) {
  if (typeof window === "undefined") return;
  const list = loadHistory().filter((a) => !sameInput(a.input, input));
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function clearAllLocalStorageEntries() {
  if (typeof window === "undefined") return;
  localStorage.clear();
}

export function deleteAnalysis(id: string) {
  const list = loadHistory().filter((x) => x.id !== id);
  localStorage.setItem(KEY, JSON.stringify(list));
}
