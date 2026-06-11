'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AlertTriangle, Trash2, Clock, Sparkles } from 'lucide-react';
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

const FREE_SAVE_LIMIT = 5;

const TABS = [
  { id: 0, label: 'Samenvatting' },
  { id: 1, label: 'Max Bod' },
  { id: 2, label: 'Verhuur' },
  { id: 3, label: 'HWM Analyse' },
  { id: 4, label: 'Verkoop' },
  { id: 5, label: 'Belasting' },
  { id: 6, label: 'AI Analyse' },
];

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

// ── Opgeslagen analyses boven het formulier ───────────────────────────────────
function HistoryList({
  sessions,
  activeId,
  onSelect,
  onDelete,
  onClearAll,
  isPro,
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

// ── Compact summary header ─────────────────────────────────────────────────────
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
      <button
        type="button"
        onClick={onReset}
        className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-md border border-border bg-background hover:bg-muted transition-colors text-muted-foreground"
      >
        Nieuwe analyse
      </button>
    </div>
  );
}

// ── Samenvatting tab ───────────────────────────────────────────────────────────
function SamenvattingTab({ input, kad }: { input: PropertyInput; kad: KadasterInfo }) {
  const warnings: { msg: string; level: 'danger' | 'warn' | 'info' }[] = [];
  if (kad.isRijksmonument)
    warnings.push({ msg: 'Rijksmonument — verbouwing vereist vergunning Rijksdienst voor het Cultureel Erfgoed.', level: 'danger' });
  if (kad.beschermdGezicht)
    warnings.push({ msg: `Beschermd stadsgezicht: ${kad.beschermdGezicht}. Wijzigingen exterieur beperkt mogelijk.`, level: 'warn' });
  if (input.erfpacht)
    warnings.push({ msg: 'Erfpacht — canon en looptijd controleren bij notaris.', level: 'warn' });
  if (input.typeWoning === 'commercieel')
    warnings.push({ msg: 'Beleggerspand: OVB 10,4% van toepassing.', level: 'info' });
  if ((kad.vboCount ?? 0) > 1)
    warnings.push({ msg: `Pand al gesplitst (${kad.vboCount} eenheden) — check VvE en splitsingsakte.`, level: 'info' });

  return (
    <div className="space-y-4">
      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((w, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 text-sm rounded-md border px-3 py-2.5 ${
                w.level === 'danger' ? 'bg-destructive/10 border-destructive/30 text-destructive'
                : w.level === 'warn' ? 'bg-warning/10 border-warning/30 text-warning'
                : 'bg-card border-border text-foreground/80'
              }`}
            >
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <span>{w.msg}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="panel p-5">
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
                { k: 'Verbouwingskosten', v: input.renovatiekostenPerM2 !== null
                    ? `€ ${input.renovatiekostenPerM2.toLocaleString('nl-NL')}/m² = ${fmtEUR(input.renovatiekostenPerM2 * input.woonoppervlakte)}`
                    : '—' },
                { k: 'Referentieprijs',   v: input.referentieprijsPerM2 !== null
                    ? `€ ${input.referentieprijsPerM2.toLocaleString('nl-NL')}/m² = ${fmtEUR(input.referentieprijsPerM2 * input.woonoppervlakte)}`
                    : '—' },
                { k: 'OVB',               v: input.eigenGebruik ? 'Eigen gebruik (2%)' : 'Belegging (10,4%)' },
                { k: 'Notariskosten',     v: fmtEUR(input.notariskosten) },
                { k: 'Taxatiekosten',     v: fmtEUR(input.taxatiekosten) },
                { k: 'Bouwkundige keur.', v: fmtEUR(input.bouwkundigeKeuring) },
                { k: 'Overige kosten',    v: input.overigeKosten > 0 ? fmtEUR(input.overigeKosten) : '—' },
              ].map(row => (
                <tr key={row.k}>
                  <td className="py-1.5 pr-3 text-muted-foreground">{row.k}</td>
                  <td className="py-1.5 font-medium tabular">{row.v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel p-5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3">Kadaster / BAG</div>
          {kad.found ? (
            <div className="space-y-3">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border">
                  {[
                    { k: 'Officieel adres',  v: kad.officielAdres ?? '—' },
                    { k: 'Woonplaats',       v: kad.woonplaats ?? '—' },
                    { k: 'Gemeente',         v: kad.gemeente ?? '—' },
                    { k: 'Buurt',            v: kad.buurt ?? '—' },
                    { k: 'BAG-id',           v: kad.bagId ?? '—' },
                    { k: 'Gebruiksdoel',     v: kad.gebruiksdoel ?? '—' },
                    { k: 'Status',           v: kad.status ?? '—' },
                    { k: 'Rijksmonument',    v: kad.isRijksmonument ? 'Ja' : 'Nee' },
                    { k: 'Beschermd gezicht',v: kad.beschermdGezicht ?? 'Nee' },
                    { k: "Splitsing (VBO's)",v: kad.vboCount !== undefined ? String(kad.vboCount) : '—' },
                    { k: 'Officieel opp.',   v: kad.officielSqm !== undefined ? `${kad.officielSqm} m²` : '—' },
                    { k: 'Perceeloppervlak', v: kad.perceelOppervlakte !== undefined ? `${kad.perceelOppervlakte} m²` : '—' },
                    { k: 'EP-label',         v: kad.energielabelEP ?? '—' },
                  ].map(row => (
                    <tr key={row.k}>
                      <td className="py-1.5 pr-3 text-muted-foreground">{row.k}</td>
                      <td className="py-1.5 font-medium">{row.v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
  );
}

// ── Main CalculatorDashboard ───────────────────────────────────────────────────
export default function CalculatorDashboard() {
  const { user } = useUser();
  const isPro = user?.publicMetadata?.isPro === true;

  const [result,    setResult]    = useState<{ id: string; input: PropertyInput; kad: KadasterInfo } | null>(null);
  const [activeTab, setActiveTab] = useState(1);
  const [sessions,  setSessions]  = useState<CalculatorSession[]>([]);

  useEffect(() => { setSessions(loadSessions()); }, []);

  const handleCalculate = useCallback((inp: PropertyInput, kad: KadasterInfo) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const currentSessions = loadSessions();

    // Only save within the free tier limit
    if (isPro || currentSessions.length < FREE_SAVE_LIMIT) {
      const session: CalculatorSession = { id, timestamp: Date.now(), input: inp, kad };
      saveSession(session);
      setSessions(loadSessions());
    }

    setResult({ id, input: inp, kad });
    setActiveTab(1);
  }, [isPro]);

  const handleSelectSession = useCallback((s: CalculatorSession) => {
    setResult({ id: s.id, input: s.input, kad: s.kad });
    setActiveTab(1);
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
    setActiveTab(1);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {!result ? (
        /* ── Formulier-weergave ── */
        <div className="max-w-3xl mx-auto px-6 py-10">
          <div className="mb-8">
            <div className="label-eyebrow mb-2">Vastgoed Calculator</div>
            <h1 className="display text-3xl font-extrabold text-navy">Investeringsanalyse</h1>
            <p className="text-muted-foreground mt-1">
              Voer de woningdata in voor accurate berekeningen op basis van jouw eigen waardeschatting.
            </p>
          </div>

          {/* Opgeslagen analyses — alleen zichtbaar als er sessies zijn */}
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

          {/* Save-limiet banner voor gratis gebruikers */}
          {!isPro && sessions.length >= FREE_SAVE_LIMIT && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-warning/30 bg-warning/5 px-4 py-2.5 text-sm">
              <div className="flex items-center gap-2 text-warning">
                <Sparkles className="size-4 shrink-0" />
                <span>
                  Je hebt de limiet van {FREE_SAVE_LIMIT} opgeslagen analyses bereikt — nieuwe analyses worden niet opgeslagen.
                </span>
              </div>
              <Link
                href="/pricing"
                className="shrink-0 text-xs font-bold text-primary hover:underline"
              >
                Upgrade →
              </Link>
            </div>
          )}

          <InputForm onCalculate={handleCalculate} />
        </div>
      ) : (
        /* ── Resultaat-weergave ── */
        <>
          <SummaryBar input={result.input} kad={result.kad} onReset={handleReset} />

          <div className="px-6 border-b border-border bg-card">
            <div className="flex gap-1 overflow-x-auto">
              {TABS.map(t => (
                <button
                  key={t.id}
                  type="button"
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

          <div className="p-6 bg-background">
            {activeTab === 0 && <SamenvattingTab input={result.input} kad={result.kad} />}
            {activeTab === 1 && <MaxBodTab       input={result.input} kad={result.kad} />}
            {activeTab === 2 && <VerhuurTab      input={result.input} kad={result.kad} />}
            {activeTab === 3 && <HwmTab          input={result.input} />}
            {activeTab === 4 && <VerkoopTab      input={result.input} kad={result.kad} />}
            {activeTab === 5 && <BelastingTab    input={result.input} kad={result.kad} />}
            {activeTab === 6 && <AIAnalyseTab    input={result.input} kad={result.kad} />}
          </div>
        </>
      )}
    </div>
  );
}
