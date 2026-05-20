'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { PropertyInput, KadasterInfo, EnergyLabel } from '@/lib/calc-types';
import { fmtEUR } from '@/lib/calculations';
import InputForm from '@/components/InputForm';
import MaxBodTab from '@/components/calculators/MaxBodTab';
import VerhuurTab from '@/components/calculators/VerhuurTab';
import VerkoopTab from '@/components/calculators/VerkoopTab';
import BelastingTab from '@/components/calculators/BelastingTab';
import AIAnalyseTab from '@/components/calculators/AIAnalyseTab';

// ── Tab definitions ────────────────────────────────────────────────────────────
const TABS = [
  { id: 0, label: 'Samenvatting' },
  { id: 1, label: 'Max Bod' },
  { id: 2, label: 'Verhuur' },
  { id: 3, label: 'Verkoop' },
  { id: 4, label: 'Belasting' },
  { id: 5, label: 'AI Analyse' },
];

// ── Label pill ─────────────────────────────────────────────────────────────────
function energielabelColor(label: EnergyLabel): string {
  switch (label) {
    case 'A+++': case 'A++': case 'A+': case 'A': return 'bg-positive/15 text-positive border-positive/30';
    case 'B': return 'bg-positive/10 text-positive/80 border-positive/20';
    case 'C': return 'bg-warning/15 text-warning border-warning/30';
    case 'D': return 'bg-warning/20 text-warning border-warning/40';
    case 'E': case 'F': return 'bg-destructive/10 text-destructive border-destructive/25';
    case 'G': return 'bg-destructive/15 text-destructive border-destructive/35';
    default: return 'bg-muted text-muted-foreground border-border';
  }
}

function Pill({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-semibold ${className}`}>
      {children}
    </span>
  );
}

// ── Compact summary header ─────────────────────────────────────────────────────
function SummaryBar({
  input,
  kad,
  onReset,
}: {
  input: PropertyInput;
  kad: KadasterInfo;
  onReset: () => void;
}) {
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
      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((w, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 text-sm rounded-md border px-3 py-2.5 ${
                w.level === 'danger'
                  ? 'bg-destructive/10 border-destructive/30 text-destructive'
                  : w.level === 'warn'
                    ? 'bg-warning/10 border-warning/30 text-warning'
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
        {/* Invoergegevens */}
        <div className="panel p-5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3">Invoergegevens</div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              {[
                { k: 'Adres', v: input.adres },
                { k: 'Vraagprijs', v: fmtEUR(input.vraagprijs) },
                { k: 'WOZ waarde', v: input.wozWaarde > 0 ? fmtEUR(input.wozWaarde) : '—' },
                { k: 'Woonoppervlakte', v: `${input.woonoppervlakte} m²` },
                { k: 'Perceeloppervlakte', v: input.perceeloppervlakte !== null ? `${input.perceeloppervlakte} m²` : 'N.v.t.' },
                { k: 'Bouwjaar', v: input.bouwjaar > 0 ? String(input.bouwjaar) : '—' },
                { k: 'Energielabel', v: input.energielabel },
                { k: 'Type woning', v: input.typeWoning.charAt(0).toUpperCase() + input.typeWoning.slice(1) },
                { k: 'Aantal kamers', v: String(input.aantalKamers) },
                { k: 'Conditie', v: input.conditie.replace('_', ' ').charAt(0).toUpperCase() + input.conditie.replace('_', ' ').slice(1) },
                { k: 'Erfpacht', v: input.erfpacht ? 'Ja' : 'Nee' },
                {
                  k: 'Verbouwingskosten',
                  v: input.renovatiekostenPerM2 !== null
                    ? `€ ${input.renovatiekostenPerM2.toLocaleString('nl-NL')}/m² = ${fmtEUR(input.renovatiekostenPerM2 * input.woonoppervlakte)}`
                    : '—'
                },
              ].map(row => (
                <tr key={row.k}>
                  <td className="py-1.5 pr-3 text-muted-foreground">{row.k}</td>
                  <td className="py-1.5 font-medium tabular">{row.v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Kadaster info */}
        <div className="panel p-5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3">Kadaster / BAG</div>
          {kad.found ? (
            <div className="space-y-3">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border">
                  {[
                    { k: 'Officieel adres', v: kad.officielAdres ?? '—' },
                    { k: 'Woonplaats', v: kad.woonplaats ?? '—' },
                    { k: 'Gemeente', v: kad.gemeente ?? '—' },
                    { k: 'Buurt', v: kad.buurt ?? '—' },
                    { k: 'BAG-id', v: kad.bagId ?? '—' },
                    { k: 'Gebruiksdoel', v: kad.gebruiksdoel ?? '—' },
                    { k: 'Status', v: kad.status ?? '—' },
                    { k: 'Rijksmonument', v: kad.isRijksmonument ? 'Ja' : 'Nee' },
                    { k: 'Beschermd gezicht', v: kad.beschermdGezicht ?? 'Nee' },
                    { k: 'Splitsing (VBO\'s)', v: kad.vboCount !== undefined ? String(kad.vboCount) : '—' },
                    { k: 'Officieel oppervlak', v: kad.officielSqm !== undefined ? `${kad.officielSqm} m²` : '—' },
                    { k: 'Perceeloppervlak', v: kad.perceelOppervlakte !== undefined ? `${kad.perceelOppervlakte} m²` : '—' },
                    { k: 'EP-label', v: kad.energielabelEP ?? '—' },
                  ].map(row => (
                    <tr key={row.k}>
                      <td className="py-1.5 pr-3 text-muted-foreground">{row.k}</td>
                      <td className="py-1.5 font-medium">{row.v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* WOZ history */}
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
            <p className="text-sm text-muted-foreground">
              Geen BAG-data beschikbaar — adres niet gevonden in PDOK.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Placeholder tab ────────────────────────────────────────────────────────────
function PlaceholderTab() {
  return (
    <div className="panel p-8 text-center text-muted-foreground">
      Komt binnenkort — verhuur / verkoop / belasting calculators
    </div>
  );
}

// ── Main CalculatorDashboard ───────────────────────────────────────────────────
export default function CalculatorDashboard() {
  const [result, setResult] = useState<{ input: PropertyInput; kad: KadasterInfo } | null>(null);
  const [activeTab, setActiveTab] = useState(1);

  const handleCalculate = (inp: PropertyInput, kad: KadasterInfo) => {
    setResult({ input: inp, kad });
    setActiveTab(1);
  };

  const handleReset = () => {
    setResult(null);
    setActiveTab(1);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <main className="w-full">
        {!result ? (
          <div className="max-w-3xl mx-auto px-6 py-10">
            <div className="mb-8">
              <div className="label-eyebrow mb-2">Vastgoed Calculator</div>
              <h1 className="display text-3xl font-extrabold text-navy">Investeringsanalyse</h1>
              <p className="text-muted-foreground mt-1">
                Voer de woningdata in voor accurate berekeningen op basis van jouw eigen waardeschatting.
              </p>
            </div>
            <InputForm
              onCalculate={handleCalculate}
            />
          </div>
        ) : (
          <>
            {/* Compact header */}
            <SummaryBar input={result.input} kad={result.kad} onReset={handleReset} />

            {/* Tab bar */}
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

            {/* Tab content */}
            <div className="p-6 bg-background">
              {activeTab === 0 && <SamenvattingTab input={result.input} kad={result.kad} />}
              {activeTab === 1 && <MaxBodTab input={result.input} kad={result.kad} />}
              {activeTab === 2 && <VerhuurTab input={result.input} kad={result.kad} />}
              {activeTab === 3 && <VerkoopTab input={result.input} kad={result.kad} />}
              {activeTab === 4 && <BelastingTab input={result.input} kad={result.kad} />}
              {activeTab === 5 && <AIAnalyseTab input={result.input} kad={result.kad} />}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
