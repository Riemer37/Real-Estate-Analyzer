// Woningwaarderingsstelsel 2024 (Wet betaalbare huur)
// Vereenvoudigde berekening voor indicatie — geen formeel advies

const ENERGIE_PUNTEN = {
  'A++++': 52, 'A+++': 44, 'A++': 40, 'A+': 36,
  'A': 22, 'B': 15, 'C': 8, 'D': 0, 'E': -3, 'F': -7, 'G': -14,
};

// Sociale huur grens 2024: 142 punten → max €879/mnd
// Middenhuur grens 2024:   187 punten → max €1124/mnd
export const WWS_SOCIAAL_GRENS  = 142;
export const WWS_MIDDEN_GRENS   = 187;
export const WWS_SOCIAAL_HUUR   = 879;
export const WWS_MIDDEN_HUUR    = 1124;

export function berekenWWS({ sqm, energy = 'C', woz_huidig = 0, rooms = 0 }) {
  // Rubriek 1: Oppervlakte — 1 punt per m²
  const opp_pts = Math.round(sqm * 1.0);

  // Rubriek 4: Energieprestatie
  const label     = (energy ?? 'C').trim().toUpperCase();
  const energie_pts = ENERGIE_PUNTEN[label] ?? ENERGIE_PUNTEN['C'];

  // Rubriek 5+6: Sanitair + keuken — aanname standaard
  const sanitair_pts = 13; // toilet(3) + douche/bad(10)
  const keuken_pts   = 8;

  // Rubriek 2: Verwarming (centrale verwarming aangenomen)
  const verwarming_pts = 2;

  // Rubriek 9: WOZ-waarde (vereenvoudigd)
  // Formule: WOZ / (157 * 55) ≈ WOZ / 8635 punten (voor gemiddelde woning)
  const woz_pts = woz_huidig > 0 ? Math.round(woz_huidig / 8635) : 0;

  const totaal = opp_pts + energie_pts + sanitair_pts + keuken_pts + verwarming_pts + woz_pts;

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
    breakdown: { opp_pts, energie_pts, sanitair_pts, keuken_pts, verwarming_pts, woz_pts },
  };
}
