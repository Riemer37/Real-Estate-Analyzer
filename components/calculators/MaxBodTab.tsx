'use client';

import { useState, useMemo } from 'react';
import type { PropertyInput, KadasterInfo } from '@/lib/calc-types';
import { fmtEUR } from '@/lib/calculations';

const LABEL_CLS = 'text-xs font-medium text-muted-foreground';
const INPUT_CLS = 'w-full bg-background border border-border rounded-md px-3 py-2 tabular text-sm';
const SECTION_HDR = 'text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3';

function Row({
  k, v, color, sub, bold, indent,
}: {
  k: string; v: string; color?: string; sub?: string; bold?: boolean; indent?: boolean;
}) {
  return (
    <div className={`flex justify-between items-baseline text-sm ${bold ? 'font-semibold' : ''}`}>
      <span className={`${indent ? 'pl-3' : ''} text-muted-foreground`}>
        {k}
        {sub && <span className="text-[11px] ml-1 text-muted-foreground/60">{sub}</span>}
      </span>
      <span className={`tabular ${color ?? ''}`}>{v}</span>
    </div>
  );
}

function Sep() {
  return <div className="border-t border-border" />;
}

interface MaxBodTabProps {
  input: PropertyInput;
  kad: KadasterInfo;
}

export default function MaxBodTab({ input }: MaxBodTabProps) {
  const [eigenGebruik, setEigenGebruik] = useState(input.typeWoning !== 'commercieel');
  const [notaris,      setNotaris]      = useState(1500);
  const [taxatie,      setTaxatie]      = useState(600);
  const [keuring,      setKeuring]      = useState(400);
  const [overig,       setOverig]       = useState(0);
  const [refPrijsPerM2, setRefPrijsPerM2] = useState(0);
  const [gewensteRoi,  setGewensteRoi]  = useState(15);

  const calc = useMemo(() => {
    const ovbPct          = eigenGebruik && input.typeWoning !== 'commercieel' ? 2 : 10.4;
    const verbouwing      = Math.round((input.renovatiekostenPerM2 ?? 0) * input.woonoppervlakte);
    const ovbBedrag       = Math.round(input.vraagprijs * (ovbPct / 100));
    const vasteKosten     = notaris + taxatie + keuring + overig;
    const bijkomend       = ovbBedrag + vasteKosten;
    const totaleInv       = input.vraagprijs + verbouwing + bijkomend;

    const verkoopwaarde   = refPrijsPerM2 > 0
      ? Math.round(refPrijsPerM2 * input.woonoppervlakte)
      : 0;

    const winst           = verkoopwaarde - totaleInv;
    const winstPerM2      = input.woonoppervlakte > 0 ? Math.round(winst / input.woonoppervlakte) : 0;
    const roi             = totaleInv > 0 && verkoopwaarde > 0 ? (winst / totaleInv) * 100 : 0;

    // Stap 4 — terugrekenen
    const gewensteWinst   = Math.round((gewensteRoi / 100) * verkoopwaarde);
    const maxVraagprijs   = verkoopwaarde > 0
      ? Math.round((verkoopwaarde - gewensteWinst - verbouwing - bijkomend) / 500) * 500
      : 0;
    const verschil        = maxVraagprijs - input.vraagprijs;
    const verschilPct     = input.vraagprijs > 0 ? (verschil / input.vraagprijs) * 100 : 0;

    return {
      ovbPct, verbouwing, ovbBedrag, vasteKosten, bijkomend,
      totaleInv, verkoopwaarde, winst, winstPerM2, roi,
      gewensteWinst, maxVraagprijs, verschil, verschilPct,
    };
  }, [eigenGebruik, notaris, taxatie, keuring, overig, refPrijsPerM2, gewensteRoi, input]);

  const hasVerkoop = calc.verkoopwaarde > 0;

  return (
    <div className="space-y-4">

      {/* ── Twee kolommen: invoer links, berekening rechts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Links — invoervelden */}
        <div className="panel p-5 space-y-5">

          {/* OVB */}
          <div>
            <div className={SECTION_HDR}>Stap 1 — Bijkomende kosten</div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">OVB</span>
              <button
                type="button"
                onClick={() => setEigenGebruik(!eigenGebruik)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  eigenGebruik
                    ? 'bg-navy text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {eigenGebruik ? 'Eigen gebruik (2%)' : 'Belegging (10,4%)'}
              </button>
            </div>
            <div className="space-y-2">
              {([
                ['Notariskosten (€)',       notaris,  setNotaris],
                ['Taxatiekosten (€)',        taxatie,  setTaxatie],
                ['Bouwkundige keuring (€)', keuring,  setKeuring],
                ['Overige kosten (€)',       overig,   setOverig],
              ] as [string, number, (v: number) => void][]).map(([lbl, val, set]) => (
                <div key={lbl} className="space-y-1">
                  <label className={LABEL_CLS}>{lbl}</label>
                  <input
                    type="number"
                    value={val}
                    onChange={e => set(Number(e.target.value) || 0)}
                    min={0}
                    className={INPUT_CLS}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Referentieprijs */}
          <div>
            <div className={SECTION_HDR}>Stap 2 — Verkoopwaarde na verbouwing</div>
            <div className="space-y-1.5">
              <label className={LABEL_CLS}>
                Wat zijn vergelijkbare verbouwde panden in de buurt waard per m²?
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground shrink-0">€</span>
                <input
                  type="number"
                  value={refPrijsPerM2 || ''}
                  onChange={e => setRefPrijsPerM2(Number(e.target.value) || 0)}
                  placeholder="bijv. 9.000"
                  min={0}
                  className={INPUT_CLS}
                />
                <span className="text-sm text-muted-foreground shrink-0">per m²</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Kijk op Funda naar recent verkochte verbouwde panden in de buurt
              </p>
            </div>
          </div>

          {/* ROI slider */}
          <div>
            <div className={SECTION_HDR}>Stap 4 — Gewenste ROI</div>
            <div className="text-sm mb-2 font-medium">
              Gewenste ROI: <span className="text-navy font-bold">{gewensteRoi}%</span>
            </div>
            <input
              type="range" min={5} max={30} step={0.5}
              value={gewensteRoi}
              onChange={e => setGewensteRoi(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
              <span>5%</span><span>30%</span>
            </div>
          </div>
        </div>

        {/* Rechts — berekeningen stap 1 t/m 3 */}
        <div className="space-y-4">

          {/* Stap 1 */}
          <div className="panel p-5 space-y-2">
            <div className={SECTION_HDR}>Stap 1 — Totale investering</div>
            <Row k="Vraagprijs" v={fmtEUR(input.vraagprijs)} bold />
            <Row
              k="+ Verbouwingskosten"
              v={`+ ${fmtEUR(calc.verbouwing)}`}
              color="text-orange-600 dark:text-orange-400"
              sub={input.renovatiekostenPerM2
                ? `(€ ${input.renovatiekostenPerM2.toLocaleString('nl-NL')} × ${input.woonoppervlakte} m²)`
                : '(niet opgegeven)'}
            />
            <Row
              k={`+ OVB (${calc.ovbPct}% × vraagprijs)`}
              v={`+ ${fmtEUR(calc.ovbBedrag)}`}
            />
            <Row k="+ Notariskosten"        v={`+ ${fmtEUR(notaris)}`} />
            <Row k="+ Taxatiekosten"         v={`+ ${fmtEUR(taxatie)}`} />
            <Row k="+ Bouwkundige keuring"   v={`+ ${fmtEUR(keuring)}`} />
            {overig > 0 && <Row k="+ Overige kosten" v={`+ ${fmtEUR(overig)}`} />}
            <Sep />
            <div className="flex justify-between items-baseline font-bold text-sm">
              <span className="text-navy">= Totale investering</span>
              <span className="text-navy text-lg tabular">{fmtEUR(calc.totaleInv)}</span>
            </div>
          </div>

          {/* Stap 2 */}
          <div className="panel p-5 space-y-2">
            <div className={SECTION_HDR}>Stap 2 — Verwachte verkoopwaarde</div>
            {refPrijsPerM2 > 0 ? (
              <>
                <Row
                  k="Referentieprijs buurt"
                  v={`€ ${refPrijsPerM2.toLocaleString('nl-NL')} per m²`}
                />
                <Row k={`× Woonoppervlakte`} v={`× ${input.woonoppervlakte} m²`} />
                <Sep />
                <div className="flex justify-between items-baseline font-bold text-sm">
                  <span className="text-navy">= Verwachte verkoopwaarde</span>
                  <span className="text-navy text-lg tabular">{fmtEUR(calc.verkoopwaarde)}</span>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Vul een referentieprijs per m² in om de verkoopwaarde te berekenen.
              </p>
            )}
          </div>

          {/* Stap 3 */}
          {hasVerkoop && (
            <div className="panel p-5 space-y-2">
              <div className={SECTION_HDR}>Stap 3 — Winst &amp; rendement</div>
              <Row k="Verwachte verkoopwaarde" v={fmtEUR(calc.verkoopwaarde)} />
              <Row
                k="− Totale investering"
                v={`− ${fmtEUR(calc.totaleInv)}`}
                color="text-destructive"
              />
              <Sep />
              <div className="flex justify-between items-baseline font-bold text-sm">
                <span>= Verwachte winst</span>
                <span className={`text-lg tabular ${calc.winst >= 0 ? 'text-positive' : 'text-destructive'}`}>
                  {fmtEUR(calc.winst)}
                </span>
              </div>
              <div className="pt-1 space-y-1 text-sm tabular">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Winst per m²</span>
                  <span className={calc.winstPerM2 >= 0 ? 'text-positive' : 'text-destructive'}>
                    {fmtEUR(calc.winstPerM2)} / m²
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ROI</span>
                  <span className={`font-bold ${calc.roi >= 0 ? 'text-positive' : 'text-destructive'}`}>
                    {calc.roi.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Stap 4 — Maximale vraagprijs (full-width, prominent) ── */}
      {hasVerkoop && (
        <div className="panel p-5 space-y-5">
          <div className={SECTION_HDR}>Stap 4 — Maximale vraagprijs bij {gewensteRoi}% gewenste ROI</div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

            {/* Terugrekening */}
            <div className="space-y-2 text-sm tabular">
              <Row k="Verwachte verkoopwaarde" v={fmtEUR(calc.verkoopwaarde)} />
              <Row
                k={`− Gewenste winst (${gewensteRoi}%)`}
                v={`− ${fmtEUR(calc.gewensteWinst)}`}
                color="text-destructive"
                sub={`(${gewensteRoi}% × verkoopwaarde)`}
              />
              <Row
                k="− Verbouwingskosten"
                v={`− ${fmtEUR(calc.verbouwing)}`}
                color="text-destructive"
              />
              <Row
                k="− Bijkomende kosten"
                v={`− ${fmtEUR(calc.bijkomend)}`}
                color="text-destructive"
                sub="(OVB + notaris + overig)"
              />
              <Sep />
              <div className="flex justify-between items-baseline font-bold">
                <span className="text-navy text-sm">= Maximale vraagprijs</span>
                <span className="text-navy text-2xl tabular">{fmtEUR(Math.max(0, calc.maxVraagprijs))}</span>
              </div>
            </div>

            {/* Verdict */}
            <div
              className={`rounded-xl border-2 p-5 text-center space-y-3 ${
                calc.verschil < 0
                  ? 'border-destructive/40 bg-destructive/5'
                  : 'border-positive/40 bg-positive/5'
              }`}
            >
              <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                Op basis van {gewensteRoi}% gewenste ROI
              </p>
              <p className="text-sm text-muted-foreground">mag je maximaal betalen:</p>
              <p className="text-3xl font-extrabold text-navy tabular">
                {fmtEUR(Math.max(0, calc.maxVraagprijs))}
              </p>

              <div className={`text-sm font-semibold ${calc.verschil < 0 ? 'text-destructive' : 'text-positive'}`}>
                {calc.verschil < 0 ? (
                  <>
                    Vraagprijs {fmtEUR(input.vraagprijs)} ligt{' '}
                    <span className="font-extrabold">{fmtEUR(Math.abs(calc.verschil))}</span>{' '}
                    ({Math.abs(calc.verschilPct).toFixed(1)}%) BOVEN je maximum
                  </>
                ) : (
                  <>
                    Vraagprijs {fmtEUR(input.vraagprijs)} ligt{' '}
                    <span className="font-extrabold">{fmtEUR(calc.verschil)}</span>{' '}
                    ({calc.verschilPct.toFixed(1)}%) onder je maximum
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Watervaldiagram ── */}
      {hasVerkoop && (
        <div className="panel p-5 space-y-4">
          <div className={SECTION_HDR}>Vermogensopbouw — overzicht</div>
          <WaterfallBar
            vraagprijs={input.vraagprijs}
            verbouwing={calc.verbouwing}
            bijkomend={calc.bijkomend}
            winst={calc.winst}
            verkoopwaarde={calc.verkoopwaarde}
          />
        </div>
      )}
    </div>
  );
}

// ── Waterfall stacked bar ──────────────────────────────────────────────────────
function WaterfallBar({
  vraagprijs, verbouwing, bijkomend, winst, verkoopwaarde,
}: {
  vraagprijs: number;
  verbouwing: number;
  bijkomend: number;
  winst: number;
  verkoopwaarde: number;
}) {
  const base = Math.max(verkoopwaarde, 1);
  const pct = (v: number) => `${Math.max(0, (v / base) * 100).toFixed(2)}%`;

  const segments = [
    { label: 'Vraagprijs',       value: vraagprijs,            color: '#3b82f6' },
    { label: 'Verbouwingskosten', value: verbouwing,            color: '#f97316' },
    { label: 'Bijkomende kosten', value: bijkomend,             color: '#94a3b8' },
    { label: winst >= 0 ? 'Verwachte winst' : 'Verlies',
      value: Math.abs(winst),
      color: winst >= 0 ? '#22c55e' : '#ef4444' },
  ];

  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      <div className="h-12 flex rounded-lg overflow-hidden border border-border">
        {segments.map(s => (
          <div
            key={s.label}
            style={{ width: pct(s.value), backgroundColor: s.color }}
            className="transition-all duration-300 first:rounded-l-lg last:rounded-r-lg"
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs tabular">
        {segments.map(s => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-muted-foreground">{s.label}:</span>
            <span className="font-semibold">{fmtEUR(s.value)}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-muted-foreground font-medium">= Verkoopwaarde:</span>
          <span className="font-bold text-navy">{fmtEUR(verkoopwaarde)}</span>
        </div>
      </div>
    </div>
  );
}
