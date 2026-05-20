'use client';

import { useState, useMemo } from 'react';
import { Info } from 'lucide-react';
import type { PropertyInput, KadasterInfo } from '@/lib/calc-types';
import { fmtEUR, fmtPct } from '@/lib/calculations';

const INPUT_CLS = 'w-full bg-background border border-border rounded-md px-3 py-2 tabular text-sm';
const SECTION_HDR = 'text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3';

function Line({ k, v, bold, color, indent }: { k: string; v: string; bold?: boolean; color?: string; indent?: boolean }) {
  return (
    <div className={`flex justify-between items-baseline text-sm ${bold ? 'font-semibold' : ''}`}>
      <span className={`${indent ? 'pl-3' : ''} text-muted-foreground`}>{k}</span>
      <span className={`tabular ${color ?? ''}`}>{v}</span>
    </div>
  );
}

interface VerkoopTabProps {
  input: PropertyInput;
  kad: KadasterInfo;
}

export default function VerkoopTab({ input }: VerkoopTabProps) {
  // Verbouwingskosten from central PropertyInput
  const renovatiekosten = Math.round((input.renovatiekostenPerM2 ?? 0) * input.woonoppervlakte);

  // ARV: initialize from central referentieprijsPerM2, editable locally
  const defaultArv = input.referentieprijsPerM2 !== null && input.referentieprijsPerM2 > 0
    ? Math.round(input.referentieprijsPerM2 * input.woonoppervlakte)
    : input.vraagprijs + Math.round(renovatiekosten * 0.7);

  const [arv,               setArv]               = useState(defaultArv);
  const [makelaarPct,       setMakelaarPct]       = useState(1.5);
  const [vasteVerkoopkosten, setVasteVerkoopkosten] = useState(2500);

  // All purchase costs from central PropertyInput — same as MaxBodTab
  const ovbPct   = input.eigenGebruik && input.typeWoning !== 'commercieel' ? 2 : 10.4;

  const calc = useMemo(() => {
    const aankoopsom     = input.vraagprijs;
    const ovb            = Math.round(aankoopsom * (ovbPct / 100));
    const bijkomend      = ovb + input.notariskosten + input.taxatiekosten + input.bouwkundigeKeuring + input.overigeKosten;
    const totaalInvestering = aankoopsom + renovatiekosten + bijkomend;
    const makelaarskosten   = Math.round(arv * (makelaarPct / 100));
    const nettowinst        = arv - totaalInvestering - makelaarskosten - vasteVerkoopkosten;
    const roi               = totaalInvestering > 0 ? (nettowinst / totaalInvestering) * 100 : 0;
    const terugverdien      = nettowinst > 0 ? totaalInvestering / nettowinst : Infinity;
    return {
      aankoopsom, ovb, ovbPct, bijkomend,
      totaalInvestering, makelaarskosten, nettowinst, roi, terugverdien,
    };
  }, [arv, makelaarPct, vasteVerkoopkosten, renovatiekosten, ovbPct,
      input.vraagprijs, input.notariskosten, input.taxatiekosten,
      input.bouwkundigeKeuring, input.overigeKosten]);

  const segments = [
    { label: 'Aankoop',   value: calc.aankoopsom,                                              color: 'var(--muted-foreground)' },
    { label: 'Verbouwing', value: renovatiekosten,                                              color: 'var(--warning)' },
    { label: 'Kosten',    value: calc.bijkomend + calc.makelaarskosten + vasteVerkoopkosten,    color: 'var(--destructive)' },
    {
      label: calc.nettowinst >= 0 ? 'Winst' : 'Verlies',
      value: Math.abs(calc.nettowinst),
      color: calc.nettowinst >= 0 ? 'var(--positive)' : 'var(--destructive)',
    },
  ];
  const chartMax = Math.max(...segments.map(s => s.value), 1);

  return (
    <div className="space-y-4">

      {/* Centrale instellingen — info banner */}
      <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs text-muted-foreground">
        <Info className="size-4 shrink-0 mt-0.5 text-primary" />
        <span>
          OVB ({input.eigenGebruik ? '2% eigen gebruik' : `${ovbPct}% belegging`}),
          verbouwingskosten en bijkomende kosten zijn gelijk aan de Max Bod tab — centraal ingesteld via het invoerformulier.
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Links: invoer + formule */}
        <div className="space-y-4">

          {/* ARV + verkoopkosten */}
          <div className="panel p-5 space-y-4">
            <div className={SECTION_HDR}>Verkoopscenario</div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Verkoopwaarde na verbouwing (€)
              </label>
              <input
                type="number"
                value={arv}
                onChange={e => setArv(Number(e.target.value) || 0)}
                min={0}
                className={INPUT_CLS}
              />
              {input.referentieprijsPerM2 !== null && input.referentieprijsPerM2 > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Standaard overgenomen van invoerformulier
                  (€ {input.referentieprijsPerM2.toLocaleString('nl-NL')} × {input.woonoppervlakte} m²)
                </p>
              )}
            </div>

            <div>
              <div className="text-sm mb-2 font-medium">
                Makelaarskosten: <span className="text-navy font-bold">{makelaarPct.toFixed(1)}%</span>
              </div>
              <input
                type="range" min={1} max={2.5} step={0.1}
                value={makelaarPct}
                onChange={e => setMakelaarPct(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                <span>1%</span><span>2,5%</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Vaste verkoopkosten (€)</label>
              <input
                type="number"
                value={vasteVerkoopkosten}
                onChange={e => setVasteVerkoopkosten(Number(e.target.value) || 0)}
                min={0}
                className={INPUT_CLS}
              />
            </div>
          </div>

          {/* Stap-voor-stap formule */}
          <div className="panel p-5 space-y-2">
            <div className={SECTION_HDR}>Berekening stap voor stap</div>

            <div className="space-y-1">
              <Line k="Aankoopsom" v={fmtEUR(calc.aankoopsom)} />
              <Line
                k="+ Verbouwingskosten"
                v={`+ ${fmtEUR(renovatiekosten)}`}
                color="text-warning"
              />
              <Line k={`+ OVB (${calc.ovbPct}%)`}            v={`+ ${fmtEUR(calc.ovb)}`}                    color="text-destructive" indent />
              <Line k="+ Notariskosten"                       v={`+ ${fmtEUR(input.notariskosten)}`}         color="text-destructive" indent />
              <Line k="+ Taxatiekosten"                       v={`+ ${fmtEUR(input.taxatiekosten)}`}         color="text-destructive" indent />
              <Line k="+ Bouwkundige keuring"                 v={`+ ${fmtEUR(input.bouwkundigeKeuring)}`}    color="text-destructive" indent />
              {input.overigeKosten > 0 && (
                <Line k="+ Overige kosten"                    v={`+ ${fmtEUR(input.overigeKosten)}`}         color="text-destructive" indent />
              )}
            </div>

            <div className="border-t border-border pt-2">
              <Line k="= Totaal investering" v={fmtEUR(calc.totaalInvestering)} bold />
            </div>

            <div className="pt-2 space-y-1">
              <Line k="Verkoopwaarde na verbouwing" v={fmtEUR(arv)}                                             color="text-positive" />
              <Line k={`− Makelaarskosten (${makelaarPct.toFixed(1)}%)`} v={`− ${fmtEUR(calc.makelaarskosten)}`} color="text-destructive" />
              <Line k="− Vaste verkoopkosten"       v={`− ${fmtEUR(vasteVerkoopkosten)}`}                        color="text-destructive" />
            </div>

            <div className="border-t border-border pt-2">
              <Line
                k="= Nettowinst"
                v={fmtEUR(calc.nettowinst)}
                bold
                color={calc.nettowinst >= 0 ? 'text-positive' : 'text-destructive'}
              />
            </div>
          </div>
        </div>

        {/* Rechts: metrics + bar chart */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="panel p-4">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">Nettowinst</div>
              <div className={`text-xl font-extrabold tabular ${calc.nettowinst >= 0 ? 'text-positive' : 'text-destructive'}`}>
                {fmtEUR(calc.nettowinst)}
              </div>
            </div>
            <div className="panel p-4">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">ROI</div>
              <div className={`text-xl font-extrabold tabular ${calc.roi >= 10 ? 'text-positive' : calc.roi >= 0 ? 'text-warning' : 'text-destructive'}`}>
                {fmtPct(calc.roi)}
              </div>
            </div>
            <div className="panel p-4">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">Totaal investering</div>
              <div className="text-xl font-extrabold tabular text-navy">{fmtEUR(calc.totaalInvestering)}</div>
            </div>
            <div className="panel p-4">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">Terugverdientijd</div>
              <div className={`text-xl font-extrabold tabular ${calc.terugverdien <= 2 ? 'text-positive' : calc.terugverdien <= 5 ? 'text-warning' : 'text-destructive'}`}>
                {calc.nettowinst > 0 ? `${calc.terugverdien.toFixed(1)} jr` : '—'}
              </div>
            </div>
          </div>

          <div className="panel p-5">
            <div className={SECTION_HDR}>Winstopbouw (waterval)</div>
            <div className="flex items-end gap-3 h-48 mt-2">
              {segments.map((s, i) => (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                  <div className="text-[10px] tabular text-muted-foreground mb-1 text-center leading-tight">
                    {fmtEUR(s.value)}
                  </div>
                  <div
                    className="w-full rounded-t transition-all"
                    style={{
                      height: `${Math.max(4, (s.value / chartMax) * 100)}%`,
                      background: s.color,
                      opacity: i === 0 ? 0.6 : 1,
                    }}
                  />
                  <div className="text-[10px] mt-1 text-center font-medium">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
