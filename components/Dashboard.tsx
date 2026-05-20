'use client';

import { useState, useCallback } from 'react';
import type { PropertyAnalysis, PandType, DataSource } from '@/lib/types';
import { Sidebar } from './Sidebar';
import { PropertyHeader } from './PropertyHeader';
import { KpiStrip } from './KpiStrip';
import { MyEstimate } from './MyEstimate';
import { Warnings } from './Warnings';
import { OverviewTab } from './tabs/OverviewTab';
import { KadasterTab } from './tabs/KadasterTab';
import { PotentialTab } from './tabs/PotentialTab';
import { PurchaseTab } from './tabs/PurchaseTab';
import { RenovationTab } from './tabs/RenovationTab';
import { ExitTab } from './tabs/ExitTab';
import { saveAnalysis, findCached } from '@/lib/storage';

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 0, label: 'Overzicht' },
  { id: 1, label: 'Kadaster & Data' },
  { id: 2, label: 'Potentieel' },
  { id: 3, label: 'Aankoop' },
  { id: 4, label: 'Renovatie' },
  { id: 5, label: 'Exitstrategie' },
];
const LOADING_STAGES_URL  = ['Pagina ophalen', 'Woninggegevens extraheren', 'Kadaster PDOK raadplegen', 'AI-analyse uitvoeren', 'Investeringsmodel bouwen'];
const LOADING_STAGES_ADDR = ['Funda doorzoeken op adres', 'Listing gevonden — pagina ophalen', 'Kadaster PDOK raadplegen', 'AI-analyse uitvoeren', 'Investeringsmodel bouwen'];

// ── Mapper: /api/analyze response → PropertyAnalysis ─────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapApiResponse(raw: Record<string, any>, input: string, pandtype: PandType): PropertyAnalysis {
  const kad   = raw.kadaster ?? {};
  const score = Math.min(10, Math.max(1, Number(raw.investment_score) || 5));

  const field_sources: Record<string, DataSource> = {};
  if (kad.found) {
    field_sources.adres = 'bag';
    field_sources.woonplaats = 'bag';
    if (kad.official_sqm)    field_sources.living_area_m2 = 'bag';
    if (kad.official_year)   field_sources.build_year     = 'bag';
    if (kad.energy_label)    field_sources.energy_label   = 'ep_online';
    else                     field_sources.energy_label   = 'funda';
  } else {
    field_sources.adres          = 'funda';
    field_sources.living_area_m2 = 'funda';
    field_sources.energy_label   = 'funda';
  }

  // WOZ history — old API stores jaar as string "2023"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wozEntries = (kad.woz_waarden ?? []).map((w: any) => ({
    jaar:   typeof w.jaar === 'string' ? parseInt(w.jaar, 10) : w.jaar,
    waarde: w.waarde,
  }));

  // AI advies: map numeric score to Dutch verdict
  const advies: PropertyAnalysis['ai']['advies'] =
    score >= 7 ? 'Kopen' : score >= 5 ? 'Voorwaardelijk' : 'Vermijden';

  // Opmerkingen: split risk_notes into sentences
  const opmerkingen: string[] = raw.risk_notes
    ? (raw.risk_notes as string).split(/\.\s+/).map((s: string) => s.trim()).filter((s: string) => s.length > 10)
    : [];

  return {
    id:        `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    input,
    pandtype,

    listing: {
      url:          raw.url || (input.startsWith('http') ? input : undefined),
      prijs:        raw.price   || undefined,
      m2:           raw.sqm     || undefined,
      bouwjaar:     raw.year    || undefined,
      energielabel: raw.energy  || undefined,
      kamers:       raw.rooms   || undefined,
      erfpacht:     raw.erfpacht === 'Ja',
    },

    pdok: {
      bagId:       kad.bag_id          || undefined,
      adres:       kad.official_address ?? raw.address ?? input,
      woonplaats:  kad.woonplaats       || undefined,
      buurt:       kad.buurtnaam        || undefined,
      gemeente:    kad.gemeentenaam     || undefined,
      lat:         kad.lat              || undefined,
      lon:         kad.lon              || undefined,
    },

    bag: {
      oppervlakte:  kad.official_sqm  || raw.sqm  || undefined,
      bouwjaar:     kad.official_year || raw.year || undefined,
      gebruiksdoel: kad.usage         || undefined,
      status:       kad.status        || undefined,
      vbos:         kad.vbo_count     || undefined,
    },

    woz:          wozEntries.length > 0 ? wozEntries : undefined,

    energielabel: {
      label:       kad.energy_label ?? raw.energy ?? 'C',
      bron:        kad.energy_label ? 'EP-online' : 'Listing',
      source_kind: kad.energy_label ? 'ep_online' : 'funda',
    },

    field_sources,

    monument: {
      rijksmonument:     kad.is_rijksmonument      ?? false,
      beschermdGezicht:  kad.is_beschermd_gezicht
        ? (kad.beschermd_gezicht_naam ?? 'Beschermd gezicht')
        : null,
    },

    perceel_m2: kad.perceel_oppervlakte || undefined,

    ai: {
      investeringsthese:     raw.full_analysis ?? raw.summary ?? '',
      advies,
      score,
      risico: {
        locatie:    Number(raw.risk_location)  || 5,
        staat:      Number(raw.risk_condition) || 5,
        markt:      Number(raw.risk_market)    || 5,
        liquiditeit:Number(raw.risk_liquidity) || 5,
      },
      marktwaarde_ai:        raw.fair_value   ?? raw.price ?? 0,
      huurwaarde_ai:         raw.monthly_rent ?? 0,
      transformatieadvies:   raw.potentieel?.advies ?? raw.advice ?? '',
      marktcontext:          raw.advice ?? raw.summary ?? '',
      opmerkingen,
      pandtype_bevestiging:  pandtype,
    },
  };
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ error }: { error: string | null }) {
  return (
    <div className="flex-1 relative overflow-hidden flex items-center justify-center min-h-[calc(100vh-0px)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/hero-architecture.jpg"
        alt="Klassieke Amsterdamse grachtenpanden"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-white/40" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-white/60" />

      <div className="relative w-full max-w-2xl mx-6 panel shadow-elevated p-8 md:p-10">
        <div className="label-eyebrow mb-3 text-center">Nederlandse Vastgoed Investment Terminal</div>
        <h1 className="display text-3xl md:text-4xl font-extrabold tracking-tight text-navy text-center leading-tight">
          Analyseer elk vastgoedobject in seconden
        </h1>
        <p className="text-sm md:text-[15px] text-muted-foreground mt-3 text-center max-w-lg mx-auto leading-relaxed">
          Plak een Funda-URL of voer een Nederlands adres in en krijg direct marktwaarde,
          maximaal bod, risicoprofiel en rendement.
        </p>

        <p className="mt-6 text-sm text-muted-foreground text-center">
          Gebruik de zijbalk links om een analyse te starten.
        </p>

        {error && (
          <p className="mt-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md p-3 text-center">{error}</p>
        )}

        <div className="mt-8 grid grid-cols-3 gap-3 text-[11px]">
          {[
            { k: 'Funda · Pararius', v: 'Automatische scraping' },
            { k: 'PDOK · BAG · RCE', v: 'Officiële databronnen' },
            { k: 'Claude AI (Anthropic)', v: 'Real-time analyse' },
          ].map((c) => (
            <div key={c.k} className="rounded-md border border-border bg-background/80 backdrop-blur p-3 text-left">
              <div className="label-eyebrow">{c.k}</div>
              <div className="text-foreground mt-1 font-medium">{c.v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Loading state ─────────────────────────────────────────────────────────────
function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="label-eyebrow">Analyse bezig</div>
      <h2 className="display text-2xl font-bold">Woning verwerken…</h2>
      <div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin mt-2" />
    </div>
  );
}


// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [analysis,     setAnalysis]     = useState<PropertyAnalysis | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [activeTab,     setActiveTab]     = useState(0);
  const [loadingStages, setLoadingStages] = useState<string[]>([]);

  const handleAnalyze = useCallback(async (q: string, pandtype: PandType) => {
    const isUrl = /^https?:\/\//i.test(q);

    // Cache hit — instant restore
    const cached = findCached(q);
    if (cached) {
      setAnalysis(cached);
      setActiveTab(0);
      setError(null);
      return;
    }

    const stages = isUrl ? LOADING_STAGES_URL : LOADING_STAGES_ADDR;
    setLoadingStages(stages);
    setLoading(true);
    setError(null);

    try {
      const endpoint = isUrl ? '/api/analyze' : '/api/address';
      const body     = isUrl ? { url: q } : { address: q };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const raw = await res.json();
      if (raw.error) throw new Error(raw.error);

      const mapped = mapApiResponse(raw, q, pandtype);
      saveAnalysis(mapped);
      setAnalysis(mapped);
      setActiveTab(0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Onbekende fout');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelectHistory = useCallback((a: PropertyAnalysis) => {
    setAnalysis(a);
    setActiveTab(0);
    setError(null);
  }, []);

  const handleUpdate = useCallback((next: PropertyAnalysis) => {
    setAnalysis(next);
    saveAnalysis(next);
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        onAnalyze={handleAnalyze}
        onSelectHistory={handleSelectHistory}
        loading={loading}
        loadingStages={loading ? loadingStages : undefined}
        current={analysis}
      />

      <main className="flex-1 min-w-0 flex flex-col overflow-y-auto">
        {loading  && <LoadingState />}
        {!loading && !analysis && <EmptyState error={error} />}

        {!loading && analysis && (
          <>
            <PropertyHeader a={analysis} />
            <MyEstimate a={analysis} onUpdate={handleUpdate} />
            <KpiStrip a={analysis} />
            <Warnings a={analysis} />

            {/* Tab bar */}
            <div className="px-6 border-b border-border bg-card">
              <div className="flex gap-1 overflow-x-auto">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`px-4 py-3 text-[12px] font-semibold uppercase tracking-wider border-b-2 -mb-px transition-colors whitespace-nowrap ${
                      activeTab === t.id
                        ? 'border-primary text-navy'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div className="p-6 flex-1 bg-background">
              {activeTab === 0 && <OverviewTab  a={analysis} />}
              {activeTab === 1 && <KadasterTab  a={analysis} onUpdate={handleUpdate} />}
              {activeTab === 2 && <PotentialTab a={analysis} />}
              {activeTab === 3 && <PurchaseTab  a={analysis} />}
              {activeTab === 4 && <RenovationTab a={analysis} />}
              {activeTab === 5 && <ExitTab      a={analysis} />}
            </div>
          </>
        )}

      </main>
    </div>
  );
}
