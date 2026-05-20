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
const TABS = ['Overzicht', 'Kadaster', 'Potentieel', 'Aankoop', 'Renovatie', 'Exitstrategie'];
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
function EmptyState() {
  return (
    <div className="px-8 py-14 max-w-4xl mx-auto">
      <div className="mb-10">
        <div className="label-eyebrow mb-3">Vastgoed Investment Platform</div>
        <h1 className="display text-4xl font-bold tracking-tight mb-4 leading-tight">
          Investeringsanalyse<br />in seconden.
        </h1>
        <p className="text-muted-foreground max-w-lg leading-relaxed">
          Plak een Funda-URL of typ een adres in de zijbalk voor een compleet investeringsdossier —
          Kadasterdata, risicoscore, renovatiebudget en exitstrategie.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          ['Woningdata', 'Prijs, m², energielabel en staat automatisch opgehaald uit elke listing.'],
          ['Kadaster BAG', 'Officiële splitsingstatus, oppervlakte en bouwjaar via PDOK API.'],
          ['Risicoanalyse', 'Locatie-, staat-, markt- en liquiditeitsrisico met een totaalscore.'],
          ['Exitstrategie', 'Verkoop- of verhuur-ROI met gezonde marge en terugverdientijd.'],
        ].map(([name, txt]) => (
          <div key={name} className="panel navy-top lift p-4">
            <div className="text-sm font-semibold text-navy mb-1.5">{name}</div>
            <div className="text-xs text-muted-foreground leading-relaxed">{txt}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          ['Werkt met', 'Funda · Pararius · meer'],
          ['Databron', 'PDOK BAG — Officieel NL register'],
          ['Aangedreven door', 'Claude AI (Anthropic)'],
        ].map(([lbl, val]) => (
          <div key={lbl} className="panel px-4 py-3">
            <div className="label-eyebrow">{lbl}</div>
            <div className="text-sm font-semibold mt-1 text-navy">{val}</div>
          </div>
        ))}
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

// ── Error state ───────────────────────────────────────────────────────────────
function ErrorState({ error, onDismiss }: { error: string; onDismiss: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-8">
      <div className="panel border-destructive/40 p-6 max-w-md text-center">
        <div className="text-destructive font-semibold mb-2">Analyse mislukt</div>
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{error}</p>
        <button
          onClick={onDismiss}
          className="text-xs px-4 py-2 rounded bg-muted hover:bg-muted/80 transition font-medium"
        >
          Opnieuw proberen
        </button>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [analysis,     setAnalysis]     = useState<PropertyAnalysis | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [activeTab,    setActiveTab]    = useState(0);
  const [loadingStages,setLoadingStages]= useState<string[]>([]);

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

      <main className="flex-1 min-w-0 overflow-y-auto">
        {loading  && <LoadingState />}
        {!loading && error && <ErrorState error={error} onDismiss={() => setError(null)} />}
        {!loading && !error && !analysis && <EmptyState />}

        {!loading && !error && analysis && (
          <>
            <PropertyHeader a={analysis} />
            <KpiStrip a={analysis} />
            <MyEstimate a={analysis} onUpdate={handleUpdate} />
            <Warnings a={analysis} />

            {/* Tab bar */}
            <div className="px-6 pt-4">
              <div className="flex border-b border-border gap-1">
                {TABS.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveTab(i)}
                    className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                      activeTab === i
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div className="px-6 py-5">
              {activeTab === 0 && <OverviewTab  a={analysis} />}
              {activeTab === 1 && <KadasterTab  a={analysis} onUpdate={handleUpdate} />}
              {activeTab === 2 && <PotentialTab a={analysis} />}
              {activeTab === 3 && <PurchaseTab  a={analysis} />}
              {activeTab === 4 && <RenovationTab a={analysis} />}
              {activeTab === 5 && <ExitTab      a={analysis} />}
            </div>
          </>
        )}

        <footer className="text-center text-[10px] text-muted-foreground py-5 border-t border-border mt-4">
          VastgoedAI · PDOK Kadaster BAG · Claude AI (Anthropic) · {new Date().getFullYear()}
        </footer>
      </main>
    </div>
  );
}
