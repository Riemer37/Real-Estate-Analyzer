export type EnergyLabel = 'A+++'|'A++'|'A+'|'A'|'B'|'C'|'D'|'E'|'F'|'G'|'Onbekend';
export type WoningType = 'tussenwoning'|'hoekwoning'|'vrijstaand'|'appartement'|'bovenwoning'|'commercieel';
export type Conditie = 'uitstekend'|'goed'|'redelijk'|'slecht'|'te_renoveren';

export interface PropertyInput {
  adres: string;
  vraagprijs: number;
  woonoppervlakte: number;
  perceeloppervlakte: number | null;  // null = not applicable
  bouwjaar: number;
  energielabel: EnergyLabel;
  typeWoning: WoningType;
  aantalKamers: number;
  conditie: Conditie;
  erfpacht: boolean;
  wozWaarde: number;           // fetched from Kadaster, user can override
  renovatiekostenPerM2: number | null;  // cost per m², total = perM2 × woonoppervlakte
}

export interface KadasterInfo {
  found: boolean;
  officielAdres?: string;
  woonplaats?: string;
  gemeente?: string;
  buurt?: string;
  bagId?: string;
  isRijksmonument: boolean;
  beschermdGezicht: string | null;
  vboCount?: number;
  isSplit?: boolean;
  gebruiksdoel?: string;
  status?: string;
  wozHistory: { jaar: number; waarde: number }[];
  wozHuidig?: number;
  energielabelEP?: string;
  perceelOppervlakte?: number;
  officielSqm?: number;
  lat?: number;
  lon?: number;
}
