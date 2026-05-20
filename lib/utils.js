import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function fmt(n) {
  try {
    return `€\u202f${parseInt(n).toLocaleString('nl-NL')}`;
  } catch {
    return '€ —';
  }
}

export function pn(v, d = 0) {
  const n = String(v).replace(/[^\d]/g, '');
  return n ? parseInt(n) : d;
}
