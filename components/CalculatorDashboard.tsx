'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AlertTriangle, Trash2, Clock, Sparkles, Printer, TrendingUp, Home, BarChart3, Brain, ChevronRight } from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import type { PropertyInput, KadasterInfo, EnergyLabel } from '@/lib/calc-types';
import { fmtEUR } from '@/lib/calculations';
import { loadSessions, saveSession, deleteSession, clearSessions, type CalculatorSession } from '@/lib/calc-storage';
import InputForm from '@/components/InputForm';
import MaxBodTab from '@/components/calculators/MaxBodTab';
import VerhuurTab from '@/components/calculators/VerhuurTab';
import VerkoopTab from '@/components/calculators/VerkoopTab';
import BelastingTab from '@/components/calculators/BelastingTab';
import AIAnalyseTab from '@/components/calculators/AIAnalyseTab';
import HwmTab from '@/components/calculators/HwmTab';
import MultiUnitTab from '@/components/calculators/MultiUnitTab';
import VerbouwTab from '@/components/calculators/VerbouwTab';
import AanhoudenTab from '@/components/calculators/AanhoudenTab';
import HypotheekTab from '@/components/calculators/HypotheekTab';
import MarktTab from '@/components/calculators/MarktTab';

const FREE_SAVE_LIMIT = 5;

// ── Tab groepen ────────────────────────────────────────────────────────────────
const ENERGIE_PUNTEN: Record<string, number> = {
  'A+++': 48, 'A++': 44, 'A+': 40, 'A': 36, 'B': 32,
  'C': 22, 'D': 14, 'E': 8, 'F': 4, 'G': 0, 'Onbekend': 14,
};

function buildTabGroups(isMultiUnit: boolean) {
  return [
    {
      id: 0,
      label: 'Overzicht',
      icon: Home,
      tabs: [
        { id: 0, label: 'Samenvatting' },
        { id: 11, label: 'Markt' },
      ],
    },
    {
      id: 1,
      label: 'Strategie',
      icon: TrendingUp,
      tabs: [
        { id: 2, label: 'Verhuur' },
        { id: 5, label: 'Verkoop' },
        { id: 9, label: 'Aanhouden' },
        { id: 8, label: 'Verbouw' },
      ],
    },
    {
      id: 2,
      label: 'Financiën',
      icon: BarChart3,
      tabs: [
        { id: 1, label: 'Max Bod' },
        { id: 10, label: 'Hypotheek' },
        { id: 6, label: 'Belasting' },
        ...(isMultiUnit ? [{ id: 4, label: 'Multi-Unit' }] : []),
      ],
    },
    {
      id: 3,
      label: 'AI & Analyse',
      icon: Brain,
      tabs: [
        { id: 7, label: 'AI Analyse' },
        { id: 3, label: 'HWM' },
      ],
    },
  ];
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function energielabelColor(label: EnergyLabel): string {
  switch (label) {
    case 'A+++': case 'A++': case 'A+': case 'A': return 'bg-positive/15 text-positive border-positive/30';
    case 'B':    return 'bg-positive/10 text-positive/80 border-positive/20';
    case 'C':    return 'bg-warning/15 text-warning border-warning/30';
    case 'D':    return 'bg-warning/20 text-warning border-warning/40';
    case 'E': case 'F': return 'bg-destructive/10 text-destructive border-destructive/25';
    case 'G':    return 'bg-destructive/15 text-destructive border-destructive/35';
    default:     return 'bg-muted text-muted-foreground border-border';
  }
}

function Pill({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-semibold ${className}`}>
      {children}
    </span>
  );
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1)  return 'Zojuist';
  if (m < 60) return `${m} min geleden`;
  if (h < 24) return `${h} uur geleden`;
  return `${d} dag${d > 1 ? 'en' : ''} geleden`;
}

// ── Risicoscore berekening ─────────────────────────────────────────────────────
function berekenRisico(input: PropertyInput, kad: KadasterInfo): {
  score: number;
  niveau: 'laag' | 'middel' | 'hoog';
  factoren: { label: string; punten: number; toelichting: string }[];
} {
  const factoren: { label: string; punten: number; toelichting: string }[] = [];

  if (input.wozWaarde > 0) {
    const wozRatio = input.vraagprijs / input.wozWaarde;
    if (wozRatio > 1.30)      factoren.push({ label: 'Vraagprijs sterk boven WOZ', punten: 20, toelichting: `${((wozRatio - 1) * 100).toFixed(0)}% boven WOZ` });
    else if (wozRatio > 1.15) factoren.push({ label: 'Vraagprijs boven WOZ', punten: 10, toelichting: `${((wozRatio - 1) * 100).toFixed(0)}% boven WOZ` });
  }

  if (['G', 'F'].includes(input.energielabel)) factoren.push({ label: 'Laag energielabel', punten: 15, toelichting: `Label ${input.energielabel} — hoge renovatiekosten verwacht` });
  else if (input.energielabel === 'E')          factoren.push({ label: 'Laag energielabel', punten: 8, toelichting: `Label ${input.energielabel} — verduurzaming nodig` });

  if (input.conditie === 'slecht')             factoren.push({ label: 'Slechte staat', punten: 20, toelichting: 'Hoge onvoorziene kosten mogelijk' });
  else if (input.conditie === 'te_renoveren')  factoren.push({ label: 'Te renoveren', punten: 10, toelichting: 'Significante verbouwing verwacht' });

  if (input.erfpacht)                          factoren.push({ label: 'Erfpacht', punten: 12, toelichting: 'Canonherziening mogelijk — check voorwaarden' });
  if (kad.isRijksmonument)                     factoren.push({ label: 'Rijksmonument', punten: 20, toelichting: 'Verbouwing beperkt en vergunningplichtig' });
  if (kad.beschermdGezicht)                    factoren.push({ label: 'Beschermd gezicht', punten: 8, toelichting: 'Exterieurwijzigingen beperkt' });

  if (kad.gemKoopsomBuurt && input.woonoppervlakte > 0) {
    const buurtRatio = input.vraagprijs / kad.gemKoopsomBuurt;
    if (buurtRatio > 1.25)      factoren.push({ label: 'Hoog t.o.v. buurtgemiddelde', punten: 15, toelichting: `${((buurtRatio - 1) * 100).toFixed(0)}% boven gem. koopsom buurt` });
    else if (buurtRatio > 1.10) factoren.push({ label: 'Boven buurtgemiddelde', punten: 8, toelichting: `${((buurtRatio - 1) * 100).toFixed(0)}% boven gem. koopsom buurt` });
  }

  const score = Math.min(100, factoren.reduce((s, f) => s + f.punten, 0));
  const niveau: 'laag' | 'middel' | 'hoog' = score <= 20 ? 'laag' : score <= 45 ? 'middel' : 'hoog';
  return { score, niveau, factoren };
}

// ── HistoryList ────────────────────────────────────────────────────────────────
function HistoryList({
  sessions, activeId, onSelect, onDelete, onClearAll, isPro,
}: {
  sessions: CalculatorSession[];
  activeId: string | null;
  onSelect: (s: CalculatorSession) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  isPro: boolean;
}) {
  if (sessions.length === 0) return null;

  return (
    <div className="panel p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 label-eyebrow">
          <Clock className="size-3" />
          Opgeslagen analyses
          {!isPro && (
            <span className="ml-1 text-[11px] font-normal text-muted-foreground/70 normal-case tracking-normal">
              ({sessions.length}/{FREE_SAVE_LIMIT})
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClearAll}
          className="text-[11px] text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
        >
          <Trash2 className="size-3" />
          Alles wissen
        </button>
      </div>

      <ul className="space-y-1">
        {sessions.map(s => {
          const active = s.id === activeId;
          return (
            <li
              key={s.id}
              className={`group flex items-center gap-2 rounded-md px-3 py-2 cursor-pointer border transition-colors ${
                active
                  ? 'bg-muted border-primary/40 shadow-[inset_2px_0_0_var(--primary)]'
                  : 'border-transparent hover:bg-muted hover:border-border'
              }`}
              onClick={() => onSelect(s)}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">
                  {s.kad.officielAdres ?? s.input.adres}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 tabular">
                  <span className="text-navy font-semibold">{fmtEUR(s.input.vraagprijs)}</span>
                  <span className="opacity-40">·</span>
                  <span>{s.input.woonoppervlakte} m²</span>
                  <span className="opacity-40">·</span>
                  <span>{relativeTime(s.timestamp)}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onDelete(s.id); }}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
                aria-label="Verwijder"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── SummaryBar ─────────────────────────────────────────────────────────────────
function SummaryBar({ input, kad, onReset }: { input: PropertyInput; kad: KadasterInfo; onReset: () => void }) {
  return (
    <div className="px-6 py-3 border-b border-border bg-card flex items-center gap-3 flex-wrap">
      <div className="flex-1 min-w-0">
        <div className="font-bold text-navy text-sm truncate">{kad.officielAdres ?? input.adres}</div>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <Pill className="source-bag">{fmtEUR(input.vraagprijs)}</Pill>
          <span className="text-muted-foreground text-[11px]">vraagprijs</span>
          {input.wozWaarde > 0 && (
            <>
              <span className="text-muted-foreground text-[11px]">·</span>
              <Pill className="bg-muted text-muted-foreground border-border">WOZ {fmtEUR(input.wozWaarde)}</Pill>
            </>
          )}
          <span className="text-muted-foreground text-[11px]">·</span>
          <Pill className="bg-muted text-muted-foreground border-border">{input.woonoppervlakte} m²</Pill>
          <span className="text-muted-foreground text-[11px]">·</span>
          <Pill className={energielabelColor(input.energielabel)}>{input.energielabel}</Pill>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => window.print()}
          className="px-3 py-1.5 text-xs font-semibold rounded-md border border-border bg-background hover:bg-muted transition-colors text-muted-foreground flex items-center gap-1.5 print:hidden"
        >
          <Printer className="size-3" />
          PDF
        </button>
        <button
          type="button"
          onClick={onReset}
          className="px-3 py-1.5 text-xs font-semibold rounded-md border border-border bg-background hover:bg-muted transition-colors text-muted-foreground print:hidden"
        >
          Nieuwe analyse
        </button>
      </div>
    </div>
  );
}

// ── Cockpit (Samenvatting) ─────────────────────────────────────────────────────
function CockpitTab({
  input,
  kad,
  onSwitchTab,
}: {
  input: PropertyInput;
  kad: KadasterInfo;
  onSwitchTab: (tabId: number) => void;
}) {
  const risico = berekenRisico(input, kad);
  const [kadOpen, setKadOpen] = useState(false);

  // WWS indicatie (met standaard-waarden voor buitenruimte/aanrecht)
  const wwsTotaal = Math.round(
    input.woonoppervlakte * 1.0 +
    (ENERGIE_PUNTEN[input.energielabel] ?? 14) +
    Math.min(33, Math.round((input.wozWaarde / Math.max(1, input.woonoppervlakte) / 100) * 0.05)) +
    4 + 3 + 6
  );
  const wwsHuur = Math.round(wwsTotaal * 6.5);
  const wwsCategorie = wwsTotaal <= 145 ? 'Sociaal' : wwsTotaal <= 186 ? 'Middenhuur' : 'Vrije sector';
  const wwsColor = wwsCategorie === 'Vrije sector' ? 'text-positive' : wwsCategorie === 'Middenhuur' ? 'text-warning' : 'text-destructive';

  // Marktpositie
  const wozRatio = input.wozWaarde > 0 ? (input.vraagprijs / input.wozWaarde - 1) * 100 : null;
  const buurtRatio = kad.gemKoopsomBuurt ? (input.vraagprijs / kad.gemKoopsomBuurt - 1) * 100 : null;
  const prijsM2 = input.woonoppervlakte > 0 ? Math.round(input.vraagprijs / input.woonoppervlakte) : 0;

  // Verdict
  const verdict =
    risico.niveau === 'hoog'
      ? { label: 'Voorzichtigheid geboden', color: 'destructive', desc: 'Meerdere risicofactoren aanwezig. Doe grondige due diligence voordat je een bod uitbrengt.' }
      : risico.niveau === 'laag' && (wozRatio === null || wozRatio <= 15)
      ? { label: 'Interessant profiel', color: 'positive', desc: 'Laag risico en redelijke marktpositie. Gebruik de detailtabs voor een volledige analyse.' }
      : { label: 'Nader onderzoeken', color: 'warning', desc: 'Gemengd beeld — er zijn aandachtspunten maar ook kansen. Zie de risicofactoren hieronder.' };

  const verdictCls = {
    positive:    'border-positive/40 bg-positive/5',
    warning:     'border-warning/40 bg-warning/5',
    destructive: 'border-destructive/40 bg-destructive/5',
  }[verdict.color];
  const verdictTextCls = {
    positive:    'text-positive',
    warning:     'text-warning',
    destructive: 'text-destructive',
  }[verdict.color];

  const risicoBarCls = { laag: 'bg-positive', middel: 'bg-warning', hoog: 'bg-destructive' }[risico.niveau];
  const risicoTextCls = { laag: 'text-positive', middel: 'text-warning', hoog: 'text-destructive' }[risico.niveau];

  // Cross-validatie: invoer vs officiële bronnen
  const sqmAfwijking = kad.officielSqm && input.woonoppervlakte > 0
    ? Math.abs(input.woonoppervlakte - kad.officielSqm) / kad.officielSqm * 100
    : null;
  const labelAfwijking = kad.energielabelEP && kad.energielabelEP !== input.energielabel;

  return (
    <div className="space-y-4">

      {/* Cross-validatie waarschuwingen */}
      {(sqmAfwijking !== null && sqmAfwijking > 10) || labelAfwijking ? (
        <div className="space-y-2">
          {sqmAfwijking !== null && sqmAfwijking > 10 && (
            <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <span>
                <strong>Oppervlakte verschil:</strong> jij hebt {input.woonoppervlakte} m² ingevoerd,
                maar BAG registreert officieel <strong>{kad.officielSqm} m²</strong> ({sqmAfwijking.toFixed(0)}% verschil).
                Controleer dit — foute m² beïnvloeden alle berekeningen.
              </span>
            </div>
          )}
          {labelAfwijking && (
            <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <span>
                <strong>Energielabel verschil:</strong> jij hebt label <strong>{input.energielabel}</strong> ingevoerd,
                maar EP-Online registreert <strong>{kad.energielabelEP}</strong>.
                {' '}Gebruik het officiële label voor accurate WWS- en renovatieberekeningen.
              </span>
            </div>
          )}
        </div>
      ) : null}

      {/* Verdict banner */}
      <div className={`rounded-xl border-2 p-5 ${verdictCls}`}>
        <div className={`text-lg font-extrabold mb-1 ${verdictTextCls}`}>{verdict.label}</div>
        <p className="text-sm text-foreground/80 leading-relaxed">{verdict.desc}</p>
      </div>

      {/* Kernmetrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Risicoscore */}
        <div className="panel p-4">
          <div className="flex items-center justify-between gap-1 mb-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Risicoscore</div>
            <span className="text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase bg-warning/10 text-warning border-warning/25">Berekend</span>
          </div>
          <div className={`text-3xl font-black tabular ${risicoTextCls}`}>{risico.score}</div>
          <div className="w-full bg-muted rounded-full h-1.5 mt-2 mb-1">
            <div className={`h-1.5 rounded-full ${risicoBarCls}`} style={{ width: `${risico.score}%` }} />
          </div>
          <div className={`text-xs font-bold uppercase tracking-wide ${risicoTextCls}`}>{risico.niveau}</div>
        </div>

        {/* Prijs per m² */}
        <div className="panel p-4">
          <div className="flex items-center justify-between gap-1 mb-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Prijs per m²</div>
            <span className="text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase bg-muted text-muted-foreground border-border">Invoer</span>
          </div>
          <div className="text-3xl font-black tabular text-navy">€{prijsM2.toLocaleString('nl-NL')}</div>
          {wozRatio !== null && (
            <div className={`text-xs font-semibold mt-2 ${Math.abs(wozRatio) <= 10 ? 'text-positive' : wozRatio > 0 ? 'text-warning' : 'text-positive'}`}>
              {wozRatio > 0 ? '+' : ''}{wozRatio.toFixed(0)}% t.o.v. WOZ
            </div>
          )}
          {buurtRatio !== null && (
            <div className="text-xs text-muted-foreground mt-0.5">
              {buurtRatio > 0 ? '+' : ''}{buurtRatio.toFixed(0)}% vs buurt
            </div>
          )}
        </div>

        {/* WWS max huur */}
        <div className="panel p-4">
          <div className="flex items-center justify-between gap-1 mb-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">WWS max huur</div>
            <span className="text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase bg-warning/10 text-warning border-warning/25">Berekend</span>
          </div>
          <div className={`text-3xl font-black tabular ${wwsColor}`}>€{wwsHuur.toLocaleString('nl-NL')}</div>
          <div className="text-xs text-muted-foreground mt-2">per maand</div>
          <div className={`text-xs font-bold mt-0.5 ${wwsColor}`}>{wwsCategorie}</div>
        </div>

        {/* Buurtdata */}
        <div className="panel p-4">
          <div className="flex items-center justify-between gap-1 mb-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Buurtgemiddelde</div>
            <span className="text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase bg-positive/10 text-positive border-positive/25">
              {kad.gemKoopsomBuurt ? 'Kadaster' : 'CBS'}
            </span>
          </div>
          {kad.gemKoopsomBuurt ? (
            <>
              <div className="text-3xl font-black tabular text-navy">€{(kad.gemKoopsomBuurt / 1000).toFixed(0)}k</div>
              <div className="text-xs text-muted-foreground mt-2">gem. koopsom</div>
              {kad.koopsomAantal && (
                <div className="text-xs text-muted-foreground mt-0.5">{kad.koopsomAantal} transacties</div>
              )}
            </>
          ) : kad.cbsGemWoningWaarde ? (
            <>
              <div className="text-3xl font-black tabular text-navy">€{(kad.cbsGemWoningWaarde / 1000).toFixed(0)}k</div>
              <div className="text-xs text-muted-foreground mt-2">CBS gem. waarde</div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground mt-2">Geen buurtdata</div>
          )}
        </div>
      </div>

      {/* Risicofactoren */}
      {risico.factoren.length > 0 && (
        <div className="panel p-5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3 flex items-center gap-1.5">
            <AlertTriangle className="size-3" />
            Risicofactoren ({risico.factoren.length})
          </div>
          <div className="space-y-2">
            {risico.factoren.map((f, i) => (
              <div key={i} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-warning shrink-0">▲</span>
                  <span className="font-medium">{f.label}</span>
                  <span className="text-muted-foreground text-xs hidden sm:inline truncate">{f.toelichting}</span>
                </div>
                <span className={`shrink-0 text-xs font-bold ${risicoTextCls}`}>+{f.punten} pt</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Snelle acties */}
      <div className="panel p-5">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3">Ga verder met</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Verhuuranalyse', sub: 'BAR, NAR & WWS', tabId: 2 },
            { label: 'Max Bod', sub: 'Rendement & bod', tabId: 1 },
            { label: 'AI Analyse', sub: '10 strategieën', tabId: 7 },
            { label: 'Verbouwraming', sub: 'Kosten & ARV', tabId: 8 },
          ].map(a => (
            <button
              key={a.tabId}
              type="button"
              onClick={() => onSwitchTab(a.tabId)}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 hover:bg-muted hover:border-primary/30 px-4 py-3 text-left transition-colors group"
            >
              <div>
                <div className="text-sm font-semibold text-foreground">{a.label}</div>
                <div className="text-[11px] text-muted-foreground">{a.sub}</div>
              </div>
              <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="rounded-md border border-border bg-muted/30 px-4 py-3 text-[11px] text-muted-foreground leading-relaxed">
        <strong>Let op:</strong> Dit is een analyse-tool op basis van openbare data (Kadaster, CBS, BAG, EP-Online).
        Alle berekeningen zijn indicatief. De app vervangt geen officieel taxatierapport, bouwkundige keuring of financieel advies.
        Betrouwbaarheid van AI-gegenereerde analyses hangt af van de ingevoerde gegevens.
      </div>

      {/* Kadaster details — inklapbaar */}
      <div className="panel overflow-hidden">
        <button
          type="button"
          onClick={() => setKadOpen(o => !o)}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/30 transition-colors"
        >
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
            Pand- &amp; BAG-gegevens
          </div>
          <ChevronRight className={`size-4 text-muted-foreground transition-transform ${kadOpen ? 'rotate-90' : ''}`} />
        </button>

        {kadOpen && (
          <div className="px-5 pb-5 border-t border-border">

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
              {/* Invoergegevens */}
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3">Invoergegevens</div>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-border">
                    {[
                      { k: 'Adres',             v: input.adres },
                      { k: 'Vraagprijs',        v: fmtEUR(input.vraagprijs) },
                      { k: 'WOZ waarde',        v: input.wozWaarde > 0 ? fmtEUR(input.wozWaarde) : '—' },
                      { k: 'Woonoppervlakte',   v: `${input.woonoppervlakte} m²` },
                      { k: 'Perceeloppervlakte',v: input.perceeloppervlakte !== null ? `${input.perceeloppervlakte} m²` : 'N.v.t.' },
                      { k: 'Energielabel',      v: input.energielabel },
                      { k: 'Type woning',       v: input.typeWoning.charAt(0).toUpperCase() + input.typeWoning.slice(1) },
                      { k: 'Aantal kamers',     v: String(input.aantalKamers) },
                      { k: 'Conditie',          v: input.conditie.replace('_', ' ').charAt(0).toUpperCase() + input.conditie.replace('_', ' ').slice(1) },
                      { k: 'Erfpacht',          v: input.erfpacht ? 'Ja' : 'Nee' },
                      { k: 'OVB',               v: input.eigenGebruik ? 'Eigen gebruik (2%)' : 'Belegging (10,4%)' },
                      { k: 'Verbouwingskosten', v: input.renovatiekostenPerM2 !== null ? `€ ${input.renovatiekostenPerM2.toLocaleString('nl-NL')}/m² = ${fmtEUR(input.renovatiekostenPerM2 * input.woonoppervlakte)}` : '—' },
                      { k: 'Referentieprijs',   v: input.referentieprijsPerM2 !== null ? `€ ${input.referentieprijsPerM2.toLocaleString('nl-NL')}/m² = ${fmtEUR(input.referentieprijsPerM2 * input.woonoppervlakte)}` : '—' },
                    ].map(row => (
                      <tr key={row.k}>
                        <td className="py-1.5 pr-3 text-muted-foreground">{row.k}</td>
                        <td className="py-1.5 font-medium tabular">{row.v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Kadaster / BAG */}
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3">Kadaster / BAG</div>
                {kad.found ? (
                  <div className="space-y-3">
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-border">
                        {[
                          { k: 'Officieel adres',     v: kad.officielAdres ?? '—' },
                          { k: 'Gemeente',            v: kad.gemeente ?? '—' },
                          { k: 'Buurt',               v: kad.buurt ?? '—' },
                          { k: 'Gebruiksdoel (BAG)',  v: kad.gebruiksdoel ?? '—' },
                          { k: 'Status',              v: kad.status ?? '—' },
                          { k: 'Rijksmonument',       v: kad.isRijksmonument ? 'Ja' : 'Nee' },
                          { k: 'Beschermd gezicht',   v: kad.beschermdGezicht ?? 'Nee' },
                          { k: "Splitsing (VBO's)",   v: kad.vboCount !== undefined ? String(kad.vboCount) : '—' },
                          { k: 'Officieel opp.',      v: kad.officielSqm !== undefined ? `${kad.officielSqm} m²` : '—' },
                          { k: 'Perceeloppervlak',    v: kad.perceelOppervlakte !== undefined ? `${kad.perceelOppervlakte} m²` : '—' },
                          { k: 'EP-label',            v: kad.energielabelEP ?? '—' },
                          { k: 'Bestemming',          v: kad.rpBestemming ?? '—' },
                          { k: 'Plandatum',           v: kad.rpPlanDatum ?? '—' },
                        ].map(row => (
                          <tr key={row.k}>
                            <td className="py-1.5 pr-3 text-muted-foreground">{row.k}</td>
                            <td className="py-1.5 font-medium">{row.v}</td>
                          </tr>
                        ))}
                        {kad.rpNaam && (
                          <tr>
                            <td className="py-1.5 pr-3 text-muted-foreground">Bestemmingsplan</td>
                            <td className="py-1.5 font-medium">
                              <a
                                href={
                                  kad.rpViewerUrl ??
                                  (kad.lon && kad.lat
                                    ? `https://www.ruimtelijkeplannen.nl/viewer/viewer?center=${kad.lon},${kad.lat}&zoomlevel=6`
                                    : 'https://www.ruimtelijkeplannen.nl/viewer/viewer')
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-navy hover:underline"
                              >
                                {kad.rpNaam} ↗
                              </a>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    <p className="text-[11px] text-muted-foreground/60 italic">
                      Gebruiksdoel (BAG) is de officieel geregistreerde functie. Registratie kan afwijken van huidig gebruik.
                    </p>
                    {kad.wozHistory.length > 0 && (
                      <div className="border-t border-border pt-3">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">WOZ-geschiedenis</div>
                        <div className="space-y-1">
                          {[...kad.wozHistory].sort((a, b) => b.jaar - a.jaar).slice(0, 5).map(w => (
                            <div key={w.jaar} className="flex justify-between text-sm tabular">
                              <span className="text-muted-foreground">{w.jaar}</span>
                              <span className="font-medium">{fmtEUR(w.waarde)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Geen BAG-data beschikbaar.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main CalculatorDashboard ───────────────────────────────────────────────────
export default function CalculatorDashboard() {
  const { user } = useUser();
  const isPro = user?.publicMetadata?.isPro === true;

  const [result,    setResult]    = useState<{ id: string; input: PropertyInput; kad: KadasterInfo } | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [sessions,  setSessions]  = useState<CalculatorSession[]>([]);

  useEffect(() => { setSessions(loadSessions()); }, []);

  const handleCalculate = useCallback((inp: PropertyInput, kad: KadasterInfo) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const currentSessions = loadSessions();
    if (isPro || currentSessions.length < FREE_SAVE_LIMIT) {
      saveSession({ id, timestamp: Date.now(), input: inp, kad });
      setSessions(loadSessions());
    }
    setResult({ id, input: inp, kad });
    setActiveTab(0);
  }, [isPro]);

  const handleSelectSession = useCallback((s: CalculatorSession) => {
    setResult({ id: s.id, input: s.input, kad: s.kad });
    setActiveTab(0);
  }, []);

  const handleDeleteSession = useCallback((id: string) => {
    deleteSession(id);
    setSessions(loadSessions());
    if (result?.id === id) setResult(null);
  }, [result]);

  const handleClearAll = useCallback(() => {
    clearSessions();
    setSessions([]);
    setResult(null);
  }, []);

  const handleReset = useCallback(() => {
    setResult(null);
    setActiveTab(0);
  }, []);

  // Groepen met multi-unit filter
  const tabGroups = result ? buildTabGroups(result.input.isMultiUnit) : buildTabGroups(false);

  // Actieve groep afleiden van activeTab
  const activeGroupIdx = tabGroups.findIndex(g => g.tabs.some(t => t.id === activeTab));
  const safeGroupIdx = activeGroupIdx >= 0 ? activeGroupIdx : 0;
  const activeGroup = tabGroups[safeGroupIdx];

  return (
    <div className="min-h-screen bg-background">
      {!result ? (
        <div className="max-w-3xl mx-auto px-6 py-10">
          <div className="mb-8">
            <div className="label-eyebrow mb-2">Vastgoed Calculator</div>
            <h1 className="display text-3xl font-extrabold text-navy">Investeringsanalyse</h1>
            <p className="text-muted-foreground mt-1">
              Voer de woningdata in voor accurate berekeningen op basis van jouw eigen waardeschatting.
            </p>
          </div>

          <div className="mb-6">
            <HistoryList
              sessions={sessions}
              activeId={result?.id ?? null}
              onSelect={handleSelectSession}
              onDelete={handleDeleteSession}
              onClearAll={handleClearAll}
              isPro={isPro}
            />
          </div>

          {!isPro && sessions.length >= FREE_SAVE_LIMIT && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-warning/30 bg-warning/5 px-4 py-2.5 text-sm">
              <div className="flex items-center gap-2 text-warning">
                <Sparkles className="size-4 shrink-0" />
                <span>
                  Je hebt de limiet van {FREE_SAVE_LIMIT} opgeslagen analyses bereikt — nieuwe analyses worden niet opgeslagen.
                </span>
              </div>
              <Link href="/pricing" className="shrink-0 text-xs font-bold text-primary hover:underline">
                Upgrade →
              </Link>
            </div>
          )}

          <InputForm onCalculate={handleCalculate} />
        </div>
      ) : (
        <>
          <SummaryBar input={result.input} kad={result.kad} onReset={handleReset} />

          {/* Gegroepeerde navigatie */}
          <div className="border-b border-border bg-card">
            {/* Groep-rij */}
            <div className="flex gap-0 px-4 sm:px-6 border-b border-border/40">
              {tabGroups.map((g, gi) => {
                const Icon = g.icon;
                const isActive = gi === safeGroupIdx;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setActiveTab(g.tabs[0].id)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider border-b-2 -mb-px transition-colors whitespace-nowrap ${
                      isActive
                        ? 'border-primary text-navy'
                        : 'border-transparent text-muted-foreground/60 hover:text-muted-foreground hover:border-border'
                    }`}
                  >
                    <Icon className="size-3" />
                    {g.label}
                  </button>
                );
              })}
            </div>
            {/* Sub-tab rij */}
            <div className="flex gap-1 overflow-x-auto scrollbar-none px-4 sm:px-6">
              {activeGroup.tabs.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`px-4 py-2.5 text-[12px] font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap ${
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

          {/* Tab-inhoud */}
          <div className="p-4 sm:p-6 bg-background">
            {activeTab === 0  && <CockpitTab input={result.input} kad={result.kad} onSwitchTab={setActiveTab} />}
            {activeTab === 1  && <MaxBodTab  input={result.input} kad={result.kad} />}
            {activeTab === 2  && <VerhuurTab input={result.input} kad={result.kad} />}
            {activeTab === 3  && <HwmTab     input={result.input} />}
            {activeTab === 4  && <MultiUnitTab input={result.input} />}
            {activeTab === 5  && <VerkoopTab input={result.input} kad={result.kad} />}
            {activeTab === 6  && <BelastingTab input={result.input} kad={result.kad} />}
            {activeTab === 7  && <AIAnalyseTab input={result.input} kad={result.kad} />}
            {activeTab === 8  && <VerbouwTab  input={result.input} />}
            {activeTab === 9  && <AanhoudenTab input={result.input} kad={result.kad} />}
            {activeTab === 10 && <HypotheekTab input={result.input} />}
            {activeTab === 11 && <MarktTab    input={result.input} kad={result.kad} />}
          </div>
        </>
      )}
    </div>
  );
}
