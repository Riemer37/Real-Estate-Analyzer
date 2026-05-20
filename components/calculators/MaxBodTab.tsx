'use client';

import { useState, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { PropertyInput, KadasterInfo } from '@/lib/calc-types';
import { fmtEUR, fmtPct, berekenRenovatiekosten } from '@/lib/calculations';
import type { PropertyAnalysis } from '@/lib/types';

const LABEL_CLS = 'text-xs font-medium text-muted-foreground';
const INPUT_CLS = 'w-full bg-background border border-border rounded-md px-3 py-2 tabular text-sm';
const SECTION_HDR = 'text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3';

function conditieToScore(conditie: PropertyInput['conditie']): number {
  switch (conditie) {
    case 'uitstekend': return 2;
    case 'goed': return 4;
    case 'redelijk': return 6;
    case 'slecht': return 8;
    case 'te_renoveren': return 9;
  }
}

function conditieToStaat(conditie: PropertyInput['conditie']): string {
  switch (conditie) {
    case 'uitstekend': return 'uitstekend';
    case 'goed': return 'goed';
    case 'redelijk': return 'redelijk';
    case 'slecht': return 'slecht';
    case 'te_renoveren': return 'slecht';
  }
}

function Line({
  k,
  v,
  bold,
  large,
  color,
  sub,
}: {
  k: string;
  v: string;
  bold?: boolean;
  large?: boolean;
  color?: string;
  sub?: string;
}) {
  return (
    <div className={`flex justify-between items-baseline ${bold ? 'font-semibold' : ''} ${large ? 'text-base' : 'text-sm'}`}>
      <span className="text-muted-foreground">
        {k}
        {sub && <span className="text-[11px] ml-1 text-muted-foreground/70">{sub}</span>}
      </span>
      <span className={color ?? ''}>{v}</span>
    </div>
  );
}

interface MaxBodTabProps {
  input: PropertyInput;
  kad: KadasterInfo;
}

export default function MaxBodTab({ input }: MaxBodTabProps) {
  const [roi, setRoi] = useState(10);
  const [eigenGebruik, setEigenGebruik] = useState(input.typeWoning !== 'commercieel');
  const [notaris, setNotaris] = useState(1500);
  const [taxatie, setTaxatie] = useState(600);
  const [keuring, setKeuring] = useState(400);

  const calc = useMemo(() => {
    const ovbPct = eigenGebruik && input.typeWoning !== 'commercieel' ? 2 : 10.4;
    const vastKosten = notaris + taxatie + keuring;
    const ovbBedrag = Math.round(input.marktwaarde * (ovbPct / 100));
    const roiBuffer = Math.round(input.marktwaarde * (roi / 100));

    let renovatiekosten: number;
    if (input.renovatiekostenEigen !== null && input.renovatiekostenEigen !== undefined) {
      renovatiekosten = input.renovatiekostenEigen;
    } else {
      const fakeAnalysis = {
        bag: { bouwjaar: input.bouwjaar, oppervlakte: input.woonoppervlakte },
        listing: { energielabel: input.energielabel },
        manual_overrides: { staat: conditieToStaat(input.conditie) },
        ai: { risico: { staat: conditieToScore(input.conditie) } },
        pandtype: input.typeWoning === 'commercieel' ? 'commercieel' : 'woning',
      } as unknown as PropertyAnalysis;
      const reno = berekenRenovatiekosten(fakeAnalysis);
      renovatiekosten = reno.totaal;
    }

    const maxBod = Math.max(
      0,
      Math.round(
        (input.marktwaarde - renovatiekosten - ovbBedrag - vastKosten - roiBuffer) / 1000
      ) * 1000
    );

    const verschil = maxBod - input.vraagprijs;
    const verschilPct = input.vraagprijs > 0 ? (verschil / input.vraagprijs) * 100 : 0;

    return { ovbPct, vastKosten, ovbBedrag, roiBuffer, renovatiekosten, maxBod, verschil, verschilPct };
  }, [roi, eigenGebruik, notaris, taxatie, keuring, input]);

  const lowBodWarning = input.vraagprijs > 0 && calc.maxBod < input.vraagprijs * 0.75;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Left — inputs */}
      <div className="panel p-5 space-y-5">
        <div className={SECTION_HDR}>Instellingen</div>

        {/* ROI slider */}
        <div>
          <div className="text-sm mb-2 font-medium">
            Gewenste ROI: <span className="text-navy font-bold">{roi}%</span>
          </div>
          <input
            type="range"
            min={5}
            max={25}
            step={0.5}
            value={roi}
            onChange={e => setRoi(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
            <span>5%</span>
            <span>25%</span>
          </div>
        </div>

        {/* Eigen gebruik toggle */}
        <div className="flex items-center justify-between">
          <span className="text-sm">Eigen gebruik</span>
          <button
            type="button"
            onClick={() => setEigenGebruik(!eigenGebruik)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              eigenGebruik
                ? 'bg-navy text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            {eigenGebruik ? 'Ja (2% OVB)' : 'Nee (10,4% OVB)'}
          </button>
        </div>

        {/* Vaste kosten inputs */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className={LABEL_CLS}>Notariskosten (€)</label>
            <input
              type="number"
              value={notaris}
              onChange={e => setNotaris(Number(e.target.value) || 0)}
              min={0}
              className={INPUT_CLS}
            />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL_CLS}>Taxatiekosten (€)</label>
            <input
              type="number"
              value={taxatie}
              onChange={e => setTaxatie(Number(e.target.value) || 0)}
              min={0}
              className={INPUT_CLS}
            />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL_CLS}>Bouwkundige keuring (€)</label>
            <input
              type="number"
              value={keuring}
              onChange={e => setKeuring(Number(e.target.value) || 0)}
              min={0}
              className={INPUT_CLS}
            />
          </div>
        </div>
      </div>

      {/* Right — formula & result */}
      <div className="panel p-5 space-y-4">
        <div className={SECTION_HDR}>Berekening stap voor stap</div>

        <div className="tabular space-y-2 text-sm">
          <Line k="Marktwaarde (basis)" v={fmtEUR(input.marktwaarde)} bold />
          <Line
            k="− Renovatiekosten"
            v={`− ${fmtEUR(calc.renovatiekosten)}`}
            color="text-destructive"
            sub={input.renovatiekostenEigen !== null ? '(eigen schatting)' : '(automatisch)'}
          />
          <Line
            k={`− OVB (${calc.ovbPct}%)`}
            v={`− ${fmtEUR(calc.ovbBedrag)}`}
            color="text-destructive"
          />
          <Line
            k="− Notaris / taxatie / keuring"
            v={`− ${fmtEUR(calc.vastKosten)}`}
            color="text-destructive"
          />
          <Line
            k="− ROI buffer"
            v={`− ${fmtEUR(calc.roiBuffer)}`}
            color="text-destructive"
            sub={`(${roi}% × marktwaarde)`}
          />
        </div>

        <div className="border-t border-border pt-3">
          <div className="flex justify-between items-baseline">
            <span className="text-sm font-bold text-navy">= Maximaal bod</span>
            <span className="text-xl font-extrabold text-navy tabular">{fmtEUR(calc.maxBod)}</span>
          </div>
        </div>

        {/* Comparison */}
        <div className="border-t border-border pt-3 space-y-2 tabular">
          <Line k="Vraagprijs" v={fmtEUR(input.vraagprijs)} />
          <Line k="Max bod" v={fmtEUR(calc.maxBod)} bold />
          <div className="flex justify-between items-baseline text-sm font-semibold">
            <span className="text-muted-foreground">Verschil</span>
            <span className={calc.verschil >= 0 ? 'text-positive' : 'text-destructive'}>
              {fmtEUR(calc.verschil)} ({fmtPct(calc.verschilPct)})
            </span>
          </div>
        </div>

        {lowBodWarning && (
          <div className="flex items-start gap-2 text-xs rounded-md border border-warning/40 bg-warning/10 text-warning p-3">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <span>
              Het maximale bod ligt meer dan 25% onder de vraagprijs. Controleer of de
              marktwaarde, renovatiekosten en ROI realistisch zijn.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
