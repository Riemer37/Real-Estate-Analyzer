'use client';

import { useState, useMemo } from 'react';
import { Info } from 'lucide-react';
import type { PropertyInput, KadasterInfo } from '@/lib/calc-types';
import { fmtEUR } from '@/lib/calculations';

const SECTION_HDR = 'text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3';

function Row({
  k, v, color, sub, bold,
}: {
  k: string; v: string; color?: string; sub?: string; bold?: boolean;
}) {
  return (
    <div className={`flex justify-between items-baseline text-sm ${bold ? 'font-semibold' : ''}`}>
      <span className="text-muted-foreground">
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
  const [gewensteRoi, setGewensteRoi] = useState(15);

  // All purchase costs read from central PropertyInput
  const ovbPct       = input.eigenGebruik && input.typeWoning !== 'commercieel' ? 2 : 10.4;
  const verbouwing   = Math.round((input.renovatiekostenPerM2 ?? 0) * input.woonoppervlakte);
  const ovbBedrag    = Math.round(input.vraagprijs * (ovbPct / 100));
  const vasteKosten  = input.notariskosten + input.taxatiekosten + input.bouwkundigeKeuring + input.overigeKosten;
  const bijkomend    = ovbBedrag + vasteKosten;
  const totaleInv    = input.vraagprijs + verbouwing + bijkomend;

  const verkoopwaarde = input.referentieprijsPerM2 !== null && input.referentieprijsPerM2 > 0
    ? Math.round(input.referentieprijsPerM2 * input.woonoppervlakte)
    : 0;

  const calc = useMemo(() => {
    const winst        = verkoopwaarde - totaleInv;
    const winstPerM2   = input.woonoppervlakte > 0 ? Math.round(winst / input.woonoppervlakte) : 0;
    const roi          = totaleInv > 0 && verkoopwaarde > 0 ? (winst / totaleInv) * 100 : 0;
    const gewensteWinst = Math.round((gewensteRoi / 100) * verkoopwaarde);
    const maxVraagprijs = verkoopwaarde > 0
      ? Math.round((verkoopwaarde - gewensteWinst - verbouwing - bijkomend) / 500) * 500
      : 0;
    const verschil     = maxVraagprijs - input.vraagprijs;
    const verschilPct  = input.vraagprijs > 0 ? (verschil / input.vraagprijs) * 100 : 0;
    return { winst, winstPerM2, roi, gewensteWinst, maxVraagprijs, verschil, verschilPct };
  }, [gewensteRoi, verkoopwaarde, totaleInv, verbouwing, bijkomend, input.woonoppervlakte, input.vraagprijs]);

  const hasVerkoop = verkoopwaarde > 0;

  return (
    <div className="space-y-4">

      {/* Centrale instellingen — info banner */}
      <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs text-muted-foreground">
        <Info className="size-4 shrink-0 mt-0.5 text-primary" />
        <span>
          OVB ({input.eigenGebruik ? '2% eigen gebruik' : '10,4% belegging'}), bijkomende kosten en verkoopwaarde worden
          centraal beheerd via het invoerformulier — pas ze daar aan voor consistentie met de Verkoop tab.
        </span>
      </div>

      {/* Twee kolommen */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Links — ROI instelling + overzicht ingestelde kosten */}
        <div className="panel p-5 space-y-5">

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

          {/* Overzicht centrale instellingen */}
          <div>
            <div className={SECTION_HDR}>Ingestelde kosten (centraal)</div>
            <div className="space-y-1.5 text-sm tabular">
              <div className="flex justify-between">
                <span className="text-muted-foreground">OVB ({ovbPct}%)</span>
                <span>{fmtEUR(ovbBedrag)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Notariskosten</span>
                <span>{fmtEUR(input.notariskosten)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Taxatiekosten</span>
                <span>{fmtEUR(input.taxatiekosten)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bouwkundige keuring</span>
                <span>{fmtEUR(input.bouwkundigeKeuring)}</span>
              </div>
              {input.overigeKosten > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Overige kosten</span>
                  <span>{fmtEUR(input.overigeKosten)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-1.5 font-semibold">
                <span className="text-muted-foreground">Totaal bijkomend</span>
                <span>{fmtEUR(bijkomend)}</span>
              </div>
            </div>
          </div>

          {/* Verbouwingskosten */}
          <div>
            <div className={SECTION_HDR}>Verbouwingskosten (centraal)</div>
            {input.renovatiekostenPerM2 !== null && input.renovatiekostenPerM2 > 0 ? (
              <div className="text-sm tabular">
                <span className="text-muted-foreground">
                  € {input.renovatiekostenPerM2.toLocaleString('nl-NL')} × {input.woonoppervlakte} m² =&nbsp;
                </span>
                <span className="font-semibold">{fmtEUR(verbouwing)}</span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Niet opgegeven in invoerformulier</p>
            )}
          </div>
        </div>

        {/* Rechts — stapsgewijze berekening */}
        <div className="space-y-4">

          {/* Stap 1 */}
          <div className="panel p-5 space-y-2">
            <div className={SECTION_HDR}>Stap 1 — Totale investering</div>
            <Row k="Vraagprijs" v={fmtEUR(input.vraagprijs)} bold />
            <Row
              k="+ Verbouwingskosten"
              v={`+ ${fmtEUR(verbouwing)}`}
              color="text-orange-600 dark:text-orange-400"
              sub={input.renovatiekostenPerM2
                ? `(€ ${input.renovatiekostenPerM2.toLocaleString('nl-NL')} × ${input.woonoppervlakte} m²)`
                : '(niet opgegeven)'}
            />
            <Row k={`+ OVB (${ovbPct}% × vraagprijs)`} v={`+ ${fmtEUR(ovbBedrag)}`} />
            <Row k="+ Notariskosten"       v={`+ ${fmtEUR(input.notariskosten)}`} />
            <Row k="+ Taxatiekosten"        v={`+ ${fmtEUR(input.taxatiekosten)}`} />
            <Row k="+ Bouwkundige keuring"  v={`+ ${fmtEUR(input.bouwkundigeKeuring)}`} />
            {input.overigeKosten > 0 && (
              <Row k="+ Overige kosten" v={`+ ${fmtEUR(input.overigeKosten)}`} />
            )}
            <Sep />
            <div className="flex justify-between items-baseline font-bold text-sm">
              <span className="text-navy">= Totale investering</span>
              <span className="text-navy text-lg tabular">{fmtEUR(totaleInv)}</span>
            </div>
          </div>

          {/* Stap 2 */}
          <div className="panel p-5 space-y-2">
            <div className={SECTION_HDR}>Stap 2 — Verwachte verkoopwaarde</div>
            {input.referentieprijsPerM2 !== null && input.referentieprijsPerM2 > 0 ? (
              <>
                <Row k="Referentieprijs buurt" v={`€ ${input.referentieprijsPerM2.toLocaleString('nl-NL')} per m²`} />
                <Row k="× Woonoppervlakte" v={`× ${input.woonoppervlakte} m²`} />
                <Sep />
                <div className="flex justify-between items-baseline font-bold text-sm">
                  <span className="text-navy">= Verwachte verkoopwaarde</span>
                  <span className="text-navy text-lg tabular">{fmtEUR(verkoopwaarde)}</span>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Vul een referentieprijs in via het invoerformulier (sectie &quot;Verkoopwaarde na verbouwing&quot;).
              </p>
            )}
          </div>

          {/* Stap 3 */}
          {hasVerkoop && (
            <div className="panel p-5 space-y-2">
              <div className={SECTION_HDR}>Stap 3 — Winst &amp; rendement</div>
              <Row k="Verwachte verkoopwaarde" v={fmtEUR(verkoopwaarde)} />
              <Row k="− Totale investering" v={`− ${fmtEUR(totaleInv)}`} color="text-destructive" />
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

      {/* Stap 4 — Maximale vraagprijs (full-width) */}
      {hasVerkoop && (
        <div className="panel p-5 space-y-5">
          <div className={SECTION_HDR}>Stap 4 — Maximale vraagprijs bij {gewensteRoi}% gewenste ROI</div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div className="space-y-2 text-sm tabular">
              <Row k="Verwachte verkoopwaarde" v={fmtEUR(verkoopwaarde)} />
              <Row
                k={`− Gewenste winst (${gewensteRoi}%)`}
                v={`− ${fmtEUR(calc.gewensteWinst)}`}
                color="text-destructive"
                sub={`(${gewensteRoi}% × verkoopwaarde)`}
              />
              <Row k="− Verbouwingskosten"  v={`− ${fmtEUR(verbouwing)}`}  color="text-destructive" />
              <Row
                k="− Bijkomende kosten"
                v={`− ${fmtEUR(bijkomend)}`}
                color="text-destructive"
                sub="(OVB + notaris + overig)"
              />
              <Sep />
              <div className="flex justify-between items-baseline font-bold">
                <span className="text-navy text-sm">= Maximale vraagprijs</span>
                <span className="text-navy text-2xl tabular">{fmtEUR(Math.max(0, calc.maxVraagprijs))}</span>
              </div>
            </div>

            <div
              className={`rounded-xl border-2 p-5 text-center space-y-3 ${
                calc.verschil < 0
                  ? 'border-destructive/40 bg-destructive/5'
                  : 'border-positive/40 bg-positive/5'
              }`}
            >
              <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                Bij gewenste ROI van {gewensteRoi}%
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

      {/* Watervaldiagram */}
      {hasVerkoop && (
        <div className="panel p-5 space-y-4">
          <div className={SECTION_HDR}>Vermogensopbouw — overzicht</div>
          <WaterfallBar
            vraagprijs={input.vraagprijs}
            verbouwing={verbouwing}
            bijkomend={bijkomend}
            winst={calc.winst}
            verkoopwaarde={verkoopwaarde}
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
    { label: 'Vraagprijs',       value: vraagprijs,        color: '#3b82f6' },
    { label: 'Verbouwingskosten', value: verbouwing,        color: '#f97316' },
    { label: 'Bijkomende kosten', value: bijkomend,         color: '#94a3b8' },
    {
      label: winst >= 0 ? 'Verwachte winst' : 'Verlies',
      value: Math.abs(winst),
      color: winst >= 0 ? '#22c55e' : '#ef4444',
    },
  ];

  return (
    <div className="space-y-3">
      <div className="h-12 flex rounded-lg overflow-hidden border border-border">
        {segments.map(s => (
          <div
            key={s.label}
            style={{ width: pct(s.value), backgroundColor: s.color }}
            className="transition-all duration-300"
          />
        ))}
      </div>
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
