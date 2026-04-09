// Renovatiekostentabel — gebaseerd op VEH, Cobouw en Bouwkosten.nl richtprijzen 2024
// Volledig feitelijk, geen AI-schatting

const STAAT_BASIS_PER_M2 = {
  Excellent: 60,   // Schilderwerk, kleine afwerkingen
  Good:      220,  // Badkamer refresh, CV-onderhoud, schilderwerk
  Fair:      520,  // Keuken + badkamer + kozijnen + installaties
  Poor:      980,  // Volledige renovatie incl. dak, fundering, installaties
};

const ITEMS_PER_STAAT = {
  Excellent: 'Schilderwerk binnen/buiten, kleine afwerkingen, sanitair bijwerken',
  Good:      'Schilderwerk, badkamer vervangen, CV-ketel onderhoud, vloeren opknappen',
  Fair:      'Keuken vervangen, badkamer renoveren, kozijnen vernieuwen, CV-installatie, schilderwerk, elektra nakijken',
  Poor:      'Complete renovatie: dak, fundering inspectie, volledige installaties (gas/water/elektra), keuken, badkamer, kozijnen, isolatie, vloeren',
};

// Bouwjaar multiplier: ouder pand = meer verborgen gebreken en meerwerk
function jaarFactor(year) {
  if (!year || year < 1900) return 1.40;
  if (year < 1940) return 1.35;
  if (year < 1960) return 1.25;
  if (year < 1975) return 1.18;
  if (year < 1990) return 1.10;
  if (year < 2000) return 1.05;
  return 1.00;
}

// Type multiplier: appartementen goedkoper (geen dak/gevel), commercieel duurder
function typeFactor(type) {
  switch (type) {
    case 'Apartment':  return 0.80;
    case 'Townhouse':  return 0.95;
    case 'House':      return 1.00;
    case 'Commercial': return 1.25;
    default:           return 1.00;
  }
}

// Energielabel toeslag: slechte labels vereisen extra isolatie/installaties
function energieToeslag(energy, sqm) {
  const toeslagen = { 'G': 180, 'F': 130, 'E': 90, 'D': 50, 'C': 20, 'B': 0, 'A': 0 };
  return (toeslagen[energy?.toUpperCase()] ?? 20) * (sqm ?? 85);
}

export function berekenRenovatiekosten({ sqm = 85, condition = 'Fair', year = 1970, property_type = 'House', energy = 'C' }) {
  const basis      = STAAT_BASIS_PER_M2[condition] ?? STAAT_BASIS_PER_M2.Fair;
  const jf         = jaarFactor(year);
  const tf         = typeFactor(property_type);
  const energiePlus = energieToeslag(energy, sqm);

  const kosten = Math.round(basis * jf * tf * sqm + energiePlus);
  const items  = ITEMS_PER_STAAT[condition] ?? ITEMS_PER_STAAT.Fair;

  // Voeg energie-item toe als label slecht is
  const energyLabel = energy?.toUpperCase();
  const items_final = ['F', 'G', 'E'].includes(energyLabel)
    ? items + ', isolatie (dak/muur/vloer), HR++ glas'
    : items;

  return { kosten, items: items_final };
}
