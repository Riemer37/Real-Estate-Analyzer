// Woningwaarderingsstelsel 2024 (Wet betaalbare huur)
// Indicatieve berekening — geen formeel huuradvies

const ENERGIE_PUNTEN = {
  'A++++': 52, 'A+++': 44, 'A++': 40, 'A+': 36,
  'A': 22, 'B': 15, 'C': 8, 'D': 0, 'E': -3, 'F': -7, 'G': -14,
};

export const WWS_SOCIAAL_GRENS = 142;
export const WWS_MIDDEN_GRENS  = 187;
export const WWS_SOCIAAL_HUUR  = 879;
export const WWS_MIDDEN_HUUR   = 1124;

export function berekenWWS({
  sqm          = 0,
  energy       = 'C',
  woz_huidig   = 0,
  buitenruimte = 0,   // m² tuin/balkon/dakterras
  aanrecht_cm  = 200, // lengte aanrecht in cm
  toiletten    = 1,
  badkamers    = 1,
}) {
  // Rubriek 1: Woonoppervlakte — 1 pt per m²
  const opp_pts = Math.max(0, Math.round(sqm));

  // Rubriek 4: Energieprestatie
  const label       = (energy ?? 'C').trim().toUpperCase();
  const energie_pts = ENERGIE_PUNTEN[label] ?? ENERGIE_PUNTEN['C'];

  // Rubriek 5: Sanitair
  // Toilet: 3 pt, Extra toilet: 1 pt
  // Bad+douche: 10 pt, Alleen douche: 7 pt, Extra badkamer: 8 pt
  const sanitair_pts = (toiletten * 3) + (badkamers * 10);

  // Rubriek 6: Keuken (aanrecht)
  // 4 pt per 60 cm aanrecht, min 4 pt, max 10 pt
  const keuken_pts = Math.min(10, Math.max(4, Math.floor(aanrecht_cm / 60) * 4));

  // Rubriek 2: Verwarming (centrale verwarming aangenomen)
  const verwarming_pts = 2;

  // Rubriek 8: Buitenruimte
  // Prive buitenruimte ≥ 4m²: +2 pt per m² tot max 15 pt
  const buiten_pts = buitenruimte >= 4 ? Math.min(15, Math.round(buitenruimte * 0.75)) : 0;

  // Rubriek 9: WOZ-waarde (vereenvoudigd)
  const woz_pts = woz_huidig > 0 ? Math.round(woz_huidig / 8635) : 0;

  const totaal = opp_pts + energie_pts + sanitair_pts + keuken_pts + verwarming_pts + buiten_pts + woz_pts;

  let categorie, max_huur;
  if (totaal < WWS_SOCIAAL_GRENS) {
    categorie = 'Sociale huur';
    max_huur  = WWS_SOCIAAL_HUUR;
  } else if (totaal < WWS_MIDDEN_GRENS) {
    categorie = 'Middenhuur';
    max_huur  = WWS_MIDDEN_HUUR;
  } else {
    categorie = 'Vrije sector';
    max_huur  = null;
  }

  return {
    totaal,
    categorie,
    max_huur,
    breakdown: { opp_pts, energie_pts, sanitair_pts, keuken_pts, verwarming_pts, buiten_pts, woz_pts },
  };
}
