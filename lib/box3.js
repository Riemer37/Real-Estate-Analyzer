// ── NIEUW: Box 3 vermogensbelasting — indicatieve berekening 2024/2025 ────────
// Gebaseerd op het forfaitaire rendement na Hoge Raad arrest (Kerstarrest)
// Wetgeving nog in ontwikkeling — gebruik uitsluitend als indicatie

const FICTIEF_RENDEMENT_OG = 0.0604; // onroerend goed 2024 (conceptbesluit Prinsjesdag)
const BOX3_TARIEF          = 0.36;   // belastingtarief Box 3 2024
const HEFFINGSVRIJ_PP      = 57000;  // heffingsvrij vermogen per persoon 2024

export function berekenBox3({
  woz_huidig = 0,
  hypotheek  = 0,
  partners   = 1, // 1 of 2 (verdubbelt heffingsvrij)
}) {
  const heffingsvrij       = HEFFINGSVRIJ_PP * partners;
  const netto_vermogen     = Math.max(0, woz_huidig - hypotheek);
  const belastbaar         = Math.max(0, netto_vermogen - heffingsvrij);
  const fictief_inkomen    = Math.round(belastbaar * FICTIEF_RENDEMENT_OG);
  const jaarlijkse_heffing = Math.round(fictief_inkomen * BOX3_TARIEF);

  return {
    jaarlijkse_heffing,
    maandelijks:         Math.round(jaarlijkse_heffing / 12),
    belastbaar_vermogen: Math.round(belastbaar),
    heffingsvrij,
    rendement_pct:       (FICTIEF_RENDEMENT_OG * 100).toFixed(2),
    methode:             `Forfaitair OG ${(FICTIEF_RENDEMENT_OG * 100).toFixed(2)}% × ${BOX3_TARIEF * 100}% (indicatief 2024)`,
  };
}
