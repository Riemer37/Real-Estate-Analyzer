'use client';

import { useState, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { PropertyInput, KadasterInfo } from '@/lib/calc-types';
import { fmtEUR, fmtPct } from '@/lib/calculations';

const LABEL_CLS = 'text-xs font-medium text-muted-foreground';
const INPUT_CLS = 'w-full bg-background border border-border rounded-md px-3 py-2 tabular text-sm';
const SECTION_HDR = 'text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3';

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
    const renovatiekosten = Math.round((input.renovatiekostenPerM2 ?? 0) * input.woonoppervlakte);
    const ovbBedrag = Math.round(input.vraagprijs * (ovbPct / 100));
    const vastKosten = notaris + taxatie + keuring;
    const aankoopkosten = ovbBedrag + vastKosten;
    const gewensteWinst = Math.round(input.vraagprijs * (roi / 100));

    const maxBod = Math.max(
      0,
      Math.round(
        (input.vraagprijs - renovatiekosten - aankoopkosten - gewensteWinst) / 1000
      ) * 1000
    );

    const verschil = maxBod - input.vraagprijs;
    const verschilPct = input.vraagprijs > 0 ? (verschil / input.vraagprijs) * 100 : 0;

    return { ovbPct, renovatiekosten, ovbBedrag, vastKosten, aankoopkosten, gewensteWinst, maxBod, verschil, verschilPct };
  }, [roi, eigenGebruik, notaris, taxatie, keuring, input]);

  const negativeBodWarning = calc.maxBod === 0 && input.vraagprijs > 0;

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
          <Line k="Vraagprijs (basis)" v={fmtEUR(input.vraagprijs)} bold />
          <Line
            k="− Verbouwingskosten"
            v={`− ${fmtEUR(calc.renovatiekosten)}`}
            color="text-destructive"
            sub={input.renovatiekostenPerM2 ? `(€${input.renovatiekostenPerM2.toLocaleString('nl-NL')} × ${input.woonoppervlakte} m²)` : '(niet opgegeven)'}
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
            k="− Gewenste winst"
            v={`− ${fmtEUR(calc.gewensteWinst)}`}
            color="text-destructive"
            sub={`(${roi}% × vraagprijs)`}
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
            <span className="text-muted-foreground">Marge t.o.v. vraagprijs</span>
            <span className={calc.verschil >= 0 ? 'text-positive' : 'text-destructive'}>
              {fmtEUR(calc.verschil)} ({fmtPct(calc.verschilPct)})
            </span>
          </div>
        </div>

        {negativeBodWarning && (
          <div className="flex items-start gap-2 text-xs rounded-md border border-warning/40 bg-warning/10 text-warning p-3">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <span>
              Het maximale bod is nul of negatief. Controleer de verbouwingskosten,
              aankoopkosten en gewenste winst.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
