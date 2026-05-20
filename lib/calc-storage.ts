import type { PropertyInput, KadasterInfo } from './calc-types';

export interface CalculatorSession {
  id: string;
  timestamp: number;
  input: PropertyInput;
  kad: KadasterInfo;
}

const KEY = 'vastgoedai:calc:v1';
const MAX = 25;

export function loadSessions(): CalculatorSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CalculatorSession[]) : [];
  } catch { return []; }
}

export function saveSession(s: CalculatorSession): void {
  if (typeof window === 'undefined') return;
  const list = loadSessions().filter(
    x => x.id !== s.id &&
    x.input.adres.trim().toLowerCase() !== s.input.adres.trim().toLowerCase()
  );
  list.unshift(s);
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
}

export function deleteSession(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(loadSessions().filter(x => x.id !== id)));
}

export function clearSessions(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
}
