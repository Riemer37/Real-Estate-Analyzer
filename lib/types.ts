export type PandType = "woning" | "nieuwbouw" | "commercieel" | "gemengd";

export type Advies = "Kopen" | "Voorwaardelijk" | "Vermijden";

export interface Listing {
  url?: string;
  prijs?: number;
  vraagprijs?: number;
  m2?: number;
  bouwjaar?: number;
  perceel_m2?: number;
  energielabel?: string;
  kamers?: number;
  slaapkamers?: number;
  adres?: string;
  erfpacht?: boolean;
  beschrijving?: string;
  bron?: "scraperapi" | "apify" | "manual";
  funda_debug?: FundaDebug;
}

export type DataSource = "funda" | "ep_online" | "altum_ai" | "bag" | "handmatig" | "schatting";
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface FundaDebug {
  html_length: number;
  next_data_found: boolean;
  blocked: boolean;
  scraperapi_debug_output?: string[];
  scraperapi_attempts?: Array<{
    scraper_url: string;
    response_status?: number;
    html_length: number;
    contains_next_data: boolean;
    first_500_chars: string;
    account_status_header?: string | null;
    credits_remaining?: string | null;
    error?: string;
  }>;
  raw_next_data?: JsonValue;
  raw_energy_label?: string;
  energy_label_field_path?: string;
  final_energy_label?: string;
  html_regex_results?: Record<string, string | number | null>;
  logs: string[];
}

export type StaatVanOnderhoud = "uitstekend" | "goed" | "redelijk" | "slecht";

export interface ManualOverrides {
  energielabel?: string;
  living_area_m2?: number;
  plot_area_m2?: number;
  plot_not_applicable?: boolean;
  asking_price?: number;
  rooms?: number;
  build_year?: number;
  woning_type?: string;
  staat?: StaatVanOnderhoud | string;
  erfpacht?: boolean;
  bijzonderheden?: string;
  marktwaarde?: number;
}

export interface PdokResult {
  bagId?: string;
  nummeraanduidingId?: string;
  adres: string;
  postcode?: string;
  woonplaats?: string;
  buurt?: string;
  gemeente?: string;
  lat?: number;
  lon?: number;
}

export interface BagData {
  oppervlakte?: number;
  gebruiksdoel?: string;
  bouwjaar?: number;
  status?: string;
  vbos?: number;
}

export interface WozEntry { jaar: number; waarde: number }

export interface AiAnalysis {
  investeringsthese: string;
  advies: Advies;
  score: number;
  risico: { locatie: number; staat: number; markt: number; liquiditeit: number };
  marktwaarde_ai: number;
  marktwaarde_onderbouwing?: string;
  marktwaarde_bandbreedte_laag?: number;
  marktwaarde_bandbreedte_hoog?: number;
  huurwaarde_ai: number;
  transformatieadvies: string;
  marktcontext: string;
  pandtype_bevestiging: PandType;
  commercieel_huurprijs_pm2?: number | null;
  bar_bruto?: number;
  nar_netto?: number;
  leegstandsrisico?: "laag" | "midden" | "hoog";
  huurprijszone?: "prime" | "secondary" | "perifeer";
  opmerkingen: string[];
}

export interface PropertyAnalysis {
  id: string;
  timestamp: number;
  input: string;
  pandtype: PandType;
  listing?: Listing;
  pdok?: PdokResult;
  bag?: BagData;
  woz?: WozEntry[];
  energielabel?: {
    label: string;
    bron?: string;
    label_secondary?: string;
    bron_secondary?: string;
    conflict?: boolean;
    needs_manual?: boolean;
    source_kind?: "funda" | "ep_online" | "handmatig" | "none";
  };
  is_apartment?: boolean;
  databronnen?: { naam: string; data: string; status: "ok" | "fail" | "estimate" }[];
  field_sources?: Record<string, DataSource>;
  manual_overrides?: ManualOverrides;
  monument?: { rijksmonument: boolean; beschermdGezicht?: string | null };
  perceel_m2?: number;
  bestemmingsplan?: { naam?: string; status?: string };
  ai: AiAnalysis;
  ai_secondary?: { bron: "anthropic"; samenvatting: string; advies?: string; score?: number };
  altum?: {
    woz_geschat?: number;
    marktwaarde?: number;
    huurwaarde?: number;
    oppervlakte?: number;
    bouwjaar?: number;
    bron: "altum_ai";
    marktwaarde_source?: "altum_avm" | "woz_x110" | "cached";
    rate_limited?: boolean;
  } | null;
  errors?: Record<string, string>;
  bronnen?: string[];
}
