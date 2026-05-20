import type { PropertyAnalysis, PandType } from "./types";

export function getMarktwaarde(a: PropertyAnalysis): number {
  const m = a.manual_overrides?.marktwaarde;
  if (typeof m === "number" && m > 0) return m;
  return suggestedMarktwaarde(a);
}

export function suggestedMarktwaarde(a: PropertyAnalysis): number {
  const woz = a.woz?.[0]?.waarde;
  if (typeof woz === "number" && woz > 0) return Math.round(woz * 1.15);
  return a.ai?.marktwaarde_ai ?? 0;
}

export function hasManualMarktwaarde(a: PropertyAnalysis): boolean {
  const m = a.manual_overrides?.marktwaarde;
  return typeof m === "number" && m > 0;
}

export function staatFactor(s?: string): number {
  switch ((s ?? "").toLowerCase()) {
    case "uitstekend": return 0.7;
    case "goed": return 0.9;
    case "redelijk": return 1.15;
    case "slecht": return 1.45;
    default: return 1;
  }
}

export const fmtEUR = (n?: number, frac = 0) =>
  typeof n === "number" && isFinite(n)
    ? n.toLocaleString("nl-NL", { style: "currency", currency: "EUR", minimumFractionDigits: frac, maximumFractionDigits: frac })
    : "—";

export const fmtNum = (n?: number, frac = 0) =>
  typeof n === "number" && isFinite(n)
    ? n.toLocaleString("nl-NL", { minimumFractionDigits: frac, maximumFractionDigits: frac })
    : "—";

export const fmtPct = (n?: number, frac = 1) =>
  typeof n === "number" && isFinite(n)
    ? `${n.toLocaleString("nl-NL", { minimumFractionDigits: frac, maximumFractionDigits: frac })}%`
    : "—";

export function ovbTarief(pandtype: PandType, eigenGebruik: boolean): number {
  if (pandtype === "commercieel") return 10.4;
  if (eigenGebruik) return 2;
  return 10.4;
}

export function berekenRenovatiekosten(a: PropertyAnalysis): {
  totaal: number;
  items: { naam: string; kosten: number; prio: "Urgent" | "Wenselijk" | "Optioneel" }[];
} {
  const m2 = a.listing?.m2 ?? a.bag?.oppervlakte ?? 100;
  const bouwjaar = a.bag?.bouwjaar ?? a.listing?.bouwjaar ?? 1980;
  const label = (a.energielabel?.label ?? a.listing?.energielabel ?? "D").toUpperCase();
  const commercieel = a.pandtype === "commercieel";
  const baseM2 = commercieel ? 1100 : 800;

  const items: { naam: string; kosten: number; prio: "Urgent" | "Wenselijk" | "Optioneel" }[] = [];
  const ouderdom = Math.max(0, 2025 - bouwjaar);
  const ageFactor = Math.min(1.6, 1 + ouderdom / 80);

  if (bouwjaar < 1990) items.push({ naam: "Dakrenovatie / isolatie", kosten: Math.round(m2 * 180 * ageFactor), prio: "Urgent" });
  if (bouwjaar < 1980) items.push({ naam: "Gevel & kozijnen", kosten: Math.round(m2 * 220 * ageFactor), prio: "Urgent" });
  if (["E", "F", "G"].includes(label)) items.push({ naam: "Energielabel-upgrade naar A", kosten: Math.round(m2 * 350), prio: "Urgent" });
  else if (["C", "D"].includes(label)) items.push({ naam: "Energielabel-upgrade naar A", kosten: Math.round(m2 * 200), prio: "Wenselijk" });
  items.push({ naam: "Installaties (cv, elektra)", kosten: Math.round(m2 * 180 * ageFactor), prio: bouwjaar < 1995 ? "Urgent" : "Wenselijk" });
  if (!commercieel) {
    items.push({ naam: "Keuken", kosten: 12000, prio: "Wenselijk" });
    items.push({ naam: "Badkamer & toilet", kosten: 14000, prio: "Wenselijk" });
  } else {
    items.push({ naam: "Pantry / sanitair", kosten: 18000, prio: "Wenselijk" });
    items.push({ naam: "Klimaatinstallatie", kosten: Math.round(m2 * 150), prio: "Urgent" });
  }
  items.push({ naam: "Schilderwerk & afwerking", kosten: Math.round(m2 * 90), prio: "Optioneel" });

  const sf = staatFactor(a.manual_overrides?.staat);
  const scaledItems = sf === 1 ? items : items.map((it) => ({ ...it, kosten: Math.round(it.kosten * sf) }));
  const totaal = scaledItems.reduce((s, it) => s + it.kosten, 0);
  return { totaal: Math.max(totaal, Math.round(m2 * baseM2 * 0.15)), items: scaledItems };
}

export function berekenPotentieel(a: PropertyAnalysis) {
  const m2 = a.listing?.m2 ?? a.bag?.oppervlakte ?? 100;
  const bouwjaar = a.bag?.bouwjaar ?? a.listing?.bouwjaar ?? 1980;
  const monument = a.monument?.rijksmonument;
  const beschermd = !!a.monument?.beschermdGezicht;
  const erfpacht = a.listing?.erfpacht;
  const perceel = a.perceel_m2 ?? 0;
  const isWoning = a.pandtype === "woning" || a.pandtype === "gemengd";

  if (a.pandtype === "nieuwbouw") {
    return { splitsen: 0, optoppen: 0, balkon: 0, aanbouw: 0, conversie: 0 };
  }

  const splitsen = isWoning && m2 >= 100 && !monument ? Math.min(10, Math.round(((m2 - 80) / 20) * 2 + (beschermd ? 0 : 2))) : 0;
  const optoppen = !beschermd && bouwjaar < 2010 ? (bouwjaar < 1970 ? 6 : 7) - (monument ? 5 : 0) : 2;
  const balkon = bouwjaar > 1950 && !monument ? 7 : 4;
  const aanbouw = perceel > (m2 + 30) && !erfpacht ? Math.min(10, Math.round((perceel - m2) / 20)) : (erfpacht ? 2 : 4);
  const conversie = a.pandtype === "commercieel" ? 6 : 0;
  return {
    splitsen: Math.max(0, splitsen),
    optoppen: Math.max(0, optoppen),
    balkon,
    aanbouw: Math.max(0, aanbouw),
    conversie,
  };
}

export function berekenWWS(
  a: PropertyAnalysis,
  opt?: { buitenruimte?: number; aanrechtCm?: number; toiletten?: number; badkamers?: number },
) {
  const m2 = a.listing?.m2 ?? a.bag?.oppervlakte ?? 80;
  const label = (a.energielabel?.label ?? a.listing?.energielabel ?? "D").toUpperCase();
  const woz = a.woz?.[0]?.waarde ?? 250000;

  const energiePunten: Record<string, number> = { "A++": 44, "A+": 40, A: 36, B: 32, C: 22, D: 14, E: 8, F: 4, G: 0 };
  const m2Punten = m2 * 1;
  const ePunten = energiePunten[label] ?? 14;
  const wozPunten = Math.min(33, Math.round((woz / m2 / 100) * 0.05));
  const buiten = (opt?.buitenruimte ?? 5) > 0 ? 2 + Math.min(8, Math.floor((opt?.buitenruimte ?? 5) / 5)) : 0;
  const aanrecht = (opt?.aanrechtCm ?? 180) >= 200 ? 6 : 4;
  const toiletten = (opt?.toiletten ?? 1) * 3;
  const badkamers = (opt?.badkamers ?? 1) * 6;

  const punten = Math.round(m2Punten + ePunten + wozPunten + buiten + aanrecht + toiletten + badkamers);
  const maxHuur = Math.round(punten * 6.5);
  const categorie = punten <= 145 ? "Sociaal" : punten <= 186 ? "Midden" : "Vrije sector";
  return { punten, maxHuur, categorie, breakdown: { m2: m2Punten, energie: ePunten, woz: wozPunten, buiten, aanrecht, toiletten, badkamers } };
}

export function berekenBox3(woz: number, hypotheek: number, partners: boolean): { jaarlijks: number; maandelijks: number } {
  const heffingsvrij = partners ? 114000 : 57000;
  const grondslag = Math.max(0, woz - hypotheek - heffingsvrij);
  const fictief = grondslag * 0.0588;
  const belasting = Math.round(fictief * 0.36);
  return { jaarlijks: belasting, maandelijks: Math.round(belasting / 12) };
}

export function berekenMaxBod(a: PropertyAnalysis, gewensteROI: number, renovatie: number, eigenGebruik: boolean): number {
  const marktwaarde = getMarktwaarde(a);
  const ovbPct = ovbTarief(a.pandtype, eigenGebruik) / 100;
  const aankoopkosten = Math.round(marktwaarde * ovbPct) + 6000;
  const roiKorting = Math.round(marktwaarde * (gewensteROI / 100));
  const bod = marktwaarde - renovatie - aankoopkosten - roiKorting;
  return Math.max(0, Math.round(bod / 1000) * 1000);
}

export function maxBodBreakdown(a: PropertyAnalysis, gewensteROI: number, renovatie: number, eigenGebruik: boolean) {
  const marktwaarde = getMarktwaarde(a);
  const ovbPct = ovbTarief(a.pandtype, eigenGebruik);
  const ovb = Math.round(marktwaarde * (ovbPct / 100));
  const bijkomend = 6000;
  const aankoopkosten = ovb + bijkomend;
  const roiKorting = Math.round(marktwaarde * (gewensteROI / 100));
  const bod = Math.max(0, marktwaarde - renovatie - aankoopkosten - roiKorting);
  return { marktwaarde, renovatie, ovb, ovbPct, bijkomend, aankoopkosten, roiKorting, gewensteROI, bod: Math.round(bod / 1000) * 1000 };
}

const APARTMENT_KEYWORDS = /(appartement|bovenwoning|benedenwoning|portiek|maisonnette|tussenverdieping|galerij|etage|flat)/i;

export function isApartment(a: PropertyAnalysis): boolean {
  if (a.is_apartment !== undefined) return a.is_apartment;
  if (a.pandtype === "commercieel") return false;
  if ((a.bag?.vbos ?? 0) > 1) return true;
  const txt = `${a.listing?.beschrijving ?? ""} ${a.listing?.adres ?? ""} ${a.pdok?.adres ?? ""}`;
  if (APARTMENT_KEYWORDS.test(txt)) return true;
  const gd = (a.bag?.gebruiksdoel ?? "").toLowerCase();
  if (gd.includes("woonfunctie") && (a.bag?.oppervlakte ?? 999) < 110 && !a.perceel_m2) return true;
  return false;
}

export function berekenBAR(jaarhuur: number, aankoopprijs: number) {
  if (!aankoopprijs) return 0;
  return (jaarhuur / aankoopprijs) * 100;
}

export function berekenNAR(jaarhuur: number, aankoopprijs: number, exploitatieRatio = 0.25) {
  if (!aankoopprijs) return 0;
  return ((jaarhuur * (1 - exploitatieRatio)) / aankoopprijs) * 100;
}
