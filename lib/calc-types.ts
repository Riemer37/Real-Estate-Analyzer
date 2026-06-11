export type EnergyLabel = 'A+++'|'A++'|'A+'|'A'|'B'|'C'|'D'|'E'|'F'|'G'|'Onbekend';
export type WoningType = 'tussenwoning'|'hoekwoning'|'vrijstaand'|'appartement'|'bovenwoning'|'commercieel';
export type Conditie = 'uitstekend'|'goed'|'redelijk'|'slecht'|'te_renoveren';
export type Bestemmingsplan = 'wonen'|'gemengd'|'commercieel'|'bedrijf'|'agrarisch'|'onbekend';
export type HuurcontractType = 'vrije_sector'|'sociaal'|'bedrijfsruimte'|'onbekend';
export type UnitGebruik = 'verhuurd'|'leeg'|'eigen_gebruik';

export interface Unit {
  id: string;
  omschrijving: string;
  oppervlakte: number;
  gebruik: UnitGebruik;
  maandhuur: number | null;
  huurcontractType: HuurcontractType;
  energielabel: EnergyLabel;
  conditie: Conditie;
  renovatiekostenPerM2: number | null;
  leegwaarde: number | null;
  vveKostenPerMaand: number | null;
}

export interface PropertyInput {
  adres: string;
  vraagprijs: number;
  woonoppervlakte: number;
  perceeloppervlakte: number | null;
  energielabel: EnergyLabel;
  typeWoning: WoningType;
  aantalKamers: number;
  conditie: Conditie;
  erfpacht: boolean;
  wozWaarde: number;
  renovatiekostenPerM2: number | null;
  // Centralized purchase costs — shared by MaxBodTab and VerkoopTab
  eigenGebruik: boolean;          // true = 2% OVB, false = 10.4%
  notariskosten: number;
  taxatiekosten: number;
  bouwkundigeKeuring: number;
  overigeKosten: number;
  // Market reference price for ARV — shared by MaxBodTab and VerkoopTab
  referentieprijsPerM2: number | null;
  // Investment profile — used for AI analysis
  bestemmingsplan: Bestemmingsplan;
  verwachteHuurprijs: number | null;
  // Verhuurd pand analyse
  huidigeHuurprijs: number | null;
  huurcontractType: HuurcontractType;
  vasteLastenPerMaand: number | null;
  // Multi-unit
  isMultiUnit: boolean;
  units: Unit[];
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
  // CBS buurtstatistieken
  cbsGemWoningWaarde?: number;
  cbsPctKoop?: number;
  cbsPctHuur?: number;
  cbsGemInkomen?: number;
  cbsLeegstand?: number;
  // Koopsommen buurt
  gemKoopsomBuurt?: number;
  koopsomAantal?: number;
  // RuimtelijkePlannen
  rpNaam?: string;
  rpPlanDatum?: string;
  rpBestemming?: string;
  rpHoofdgroep?: string;
}
