// Objectieve risicoscore — volledig op basis van meetbare feiten
// Geen AI-oordeel: elke score is herleidbaar naar databronnen

function toLabel(score) {
  return score <= 3 ? 'Low' : score <= 6 ? 'Medium' : 'High';
}

function clamp(v, min = 1, max = 9) {
  return Math.max(min, Math.min(max, v));
}

export function berekenRisico({
  price       = 0,
  fair_value  = 0,
  woz_huidig  = 0,
  year        = 1970,
  energy      = 'C',
  condition   = 'Fair',
  property_type = 'House',
  sqm         = 85,
  is_rijksmonument = false,
  is_beschermd_gezicht = false,
  erfpacht    = 'Onbekend',
}) {
  // ── Locatierisico ────────────────────────────────────────────────────────────
  // Basis: WOZ-ratio (lage WOZ = minder gewild / trage waardeontwikkeling)
  let location_score = 5;
  if (woz_huidig > 0 && price > 0) {
    const ratio = price / woz_huidig;
    if      (ratio < 0.85) location_score = 7;  // ver onder WOZ: signaal distress of slechte buurt
    else if (ratio < 1.05) location_score = 3;  // rond WOZ: marktconform, laag risico
    else if (ratio < 1.30) location_score = 4;  // licht boven: gezonde markt
    else if (ratio < 1.60) location_score = 5;  // sterk boven: populair maar duur
    else                   location_score = 7;  // ver boven WOZ: overprijzing risico
  }
  // Monument/beschermd gezicht verhoogt locatierisico door verbouwingsbeperkingen
  if (is_rijksmonument)        location_score = clamp(location_score + 2);
  if (is_beschermd_gezicht)    location_score = clamp(location_score + 1);
  // Erfpacht verhoogt risico
  if (erfpacht === 'Ja')       location_score = clamp(location_score + 2);

  // ── Conditierisico ───────────────────────────────────────────────────────────
  const yearScore = year < 1940 ? 8 : year < 1960 ? 6 : year < 1975 ? 5 : year < 1990 ? 4 : year < 2005 ? 2 : 1;
  const energyMap = { 'A++++': 1, 'A+++': 1, 'A++': 1, 'A+': 1, 'A': 2, 'B': 3, 'C': 4, 'D': 5, 'E': 7, 'F': 8, 'G': 9 };
  const energyScore = energyMap[energy?.toUpperCase()] ?? 4;
  const condMap  = { Excellent: 1, Good: 3, Fair: 6, Poor: 9 };
  const condScore = condMap[condition] ?? 5;
  const condition_score = clamp(Math.round((yearScore * 0.4 + energyScore * 0.3 + condScore * 0.3)));

  // ── Marktrisico ──────────────────────────────────────────────────────────────
  // Vraagprijs vs. berekende marktwaarde — hoe ver boven fair value is duurder
  let market_score = 5;
  if (fair_value > 0 && price > 0) {
    const overpriced = (price - fair_value) / fair_value * 100;
    if      (overpriced < -15) market_score = 2;  // sterk onder marktwaarde: koop-kans
    else if (overpriced <  -5) market_score = 3;
    else if (overpriced <   5) market_score = 4;  // marktconform
    else if (overpriced <  15) market_score = 6;
    else if (overpriced <  25) market_score = 7;
    else                       market_score = 9;  // sterk overbeprijsd
  }

  // ── Liquiditeitsrisico ───────────────────────────────────────────────────────
  // Kleine appartementen en standaard woningen zijn het makkelijkst te verkopen
  const typeLiq = { Apartment: 3, Townhouse: 4, House: 5, Commercial: 8 }[property_type] ?? 5;
  const sqmLiq  = sqm > 250 ? 3 : sqm > 150 ? 2 : sqm < 40 ? 2 : 0;
  const priceLiq = price > 1500000 ? 3 : price > 800000 ? 2 : price > 500000 ? 1 : 0;
  const liquidity_score = clamp(typeLiq + sqmLiq + priceLiq);

  // ── Totaalscore (gewogen) ────────────────────────────────────────────────────
  const total = clamp(
    Math.round(
      location_score  * 0.25 +
      condition_score * 0.25 +
      market_score    * 0.35 +
      liquidity_score * 0.15
    ), 1, 10
  );

  return {
    risk_score:     total,
    risk_location:  toLabel(location_score),
    risk_condition: toLabel(condition_score),
    risk_market:    toLabel(market_score),
    risk_liquidity: toLabel(liquidity_score),
    // Toelichting voor in de UI
    risk_notes_factual: buildNotes({ location_score, condition_score, market_score, liquidity_score,
      is_rijksmonument, erfpacht, year, energy, price, fair_value, woz_huidig }),
  };
}

function buildNotes({ location_score, condition_score, market_score, liquidity_score,
  is_rijksmonument, erfpacht, year, energy, price, fair_value, woz_huidig }) {
  const notes = [];

  if (market_score >= 7 && fair_value > 0)
    notes.push(`Vraagprijs ligt ${Math.round((price - fair_value) / fair_value * 100)}% boven de berekende marktwaarde — onderhandelen of passeren.`);
  if (market_score <= 3 && fair_value > 0)
    notes.push(`Vraagprijs ligt onder de berekende marktwaarde — potentieel koopkans.`);
  if (is_rijksmonument)
    notes.push('Rijksmonument: verbouwingen vereisen RCE-goedkeuring — hogere kosten en langere doorlooptijd.');
  if (erfpacht === 'Ja')
    notes.push('Erfpacht: controleer canon-herziening en looptijd zorgvuldig.');
  if (year < 1960 && condition_score >= 6)
    notes.push(`Bouwjaar ${year}: kans op verborgen gebreken (fundering, leidingen, asbest).`);
  if (['F', 'G', 'E'].includes(energy?.toUpperCase()))
    notes.push(`Energielabel ${energy}: aankomende EU-regelgeving (EPC2) maakt label D+ verplicht — isolatiekosten onvermijdelijk.`);
  if (woz_huidig > 0 && price > 0 && (price / woz_huidig) < 0.90)
    notes.push('Vraagprijs ver onder WOZ-waarde: controleer op achterstallig onderhoud of juridische obstakels.');

  return notes.slice(0, 2).join(' ') || null;
}
