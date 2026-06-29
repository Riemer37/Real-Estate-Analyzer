'use client';

import { useState, useMemo } from 'react';
import type { PropertyInput, KadasterInfo } from '@/lib/calc-types';
import { fmtEUR, fmtPct } from '@/lib/calculations';

const INPUT_CLS = 'w-full bg-background border border-border rounded-md px-3 py-2 tabular text-sm';
const SECTION_HDR = 'text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3';

const ENERGIE_PUNTEN: Record<string, number> = {
  'A+++': 48, 'A++': 44, 'A+': 40, 'A': 36, 'B': 32,
  'C': 22, 'D': 14, 'E': 8, 'F': 4, 'G': 0, 'Onbekend': 14,
};

function Line({ k, v, bold, color, sub }: { k: string; v: string; bold?: boolean; color?: string; sub?: string }) {
  return (
    <div className={`flex justify-between items-baseline ${bold ? 'font-semibold' : ''} text-sm`}>
      <span className="text-muted-foreground">
        {k}
        {sub && <span className="text-[11px] ml-1 text-muted-foreground/70">{sub}</span>}
      </span>
      <span className={`tabular ${color ?? ''}`}>{v}</span>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="panel p-4">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">{label}</div>
      <div className={`text-xl font-extrabold tabular ${color ?? 'text-navy'}`}>{value}</div>
    </div>
  );
}

interface VerhuurTabProps {
  input: PropertyInput;
  kad: KadasterInfo;
}

export default function VerhuurTab({ input, kad }: VerhuurTabProps) {
  // WWS controls
  const [buitenruimte, setBuitenruimte] = useState(0);
  const [aanrechtGroot, setAanrechtGroot] = useState(false);
  const [toiletten] = useState(1);
  const [badkamers] = useState(1);

  // Rendement controls
  const [leegstand, setLeegstand] = useState(5);
  const [jaarkosten, setJaarkosten] = useState(2500);
  const [waardestijging, setWaardestijging] = useState(2);
  const [eigenInbreng, setEigenInbreng] = useState(Math.round(input.vraagprijs * 0.30));

  const wws = useMemo(() => {
    const m2Punten = input.woonoppervlakte * 1.0;
    const energiePunten = ENERGIE_PUNTEN[input.energielabel] ?? 14;
    const wozPunten = Math.min(33, Math.round((input.wozWaarde / input.woonoppervlakte / 100) * 0.05));
    const buitenPunten = buitenruimte > 0 ? 2 + Math.min(8, Math.floor(buitenruimte / 5)) : 0;
    const aanrechtPunten = aanrechtGroot ? 6 : 4;
    const toiletPunten = toiletten * 3;
    const badkamerPunten = badkamers * 6;
    const totaal = Math.round(m2Punten + energiePunten + wozPunten + buitenPunten + aanrechtPunten + toiletPunten + badkamerPunten);
    const maxHuur = Math.round(totaal * 6.50);
    const categorie = totaal <= 145 ? 'Sociaal' : totaal <= 186 ? 'Middenhuur' : 'Vrije sector';
    return { m2Punten, energiePunten, wozPunten, buitenPunten, aanrechtPunten, toiletPunten, badkamerPunten, totaal, maxHuur, categorie };
  }, [input.woonoppervlakte, input.energielabel, input.wozWaarde, buitenruimte, aanrechtGroot, toiletten, badkamers]);

  const [maandhuur, setMaandhuur] = useState(() => wws.maxHuur);

  const rendement = useMemo(() => {
    const jaarhuurEffectief = maandhuur * 12 * (1 - leegstand / 100);
    const bar = input.vraagprijs > 0 ? (jaarhuurEffectief / input.vraagprijs) * 100 : 0;
    const nar = input.vraagprijs > 0 ? ((jaarhuurEffectief - jaarkosten) / input.vraagprijs) * 100 : 0;
    const cashflowJaar1 = jaarhuurEffectief - jaarkosten;
    const cashOnCash = eigenInbreng > 0 ? (cashflowJaar1 / eigenInbreng) * 100 : 0;
    const terugverdien = input.vraagprijs / Math.max(1, cashflowJaar1);
    return { jaarhuurEffectief, bar, nar, cashflowJaar1, cashOnCash, terugverdien };
  }, [maandhuur, leegstand, jaarkosten, eigenInbreng, input.vraagprijs]);

  const chartData = useMemo(() => {
    const jaren = 10;
    const pts: number[] = [];
    let running = 0;
    let waarde = input.vraagprijs;
    for (let y = 1; y <= jaren; y++) {
      running += rendement.cashflowJaar1;
      waarde *= 1 + waardestijging / 100;
      pts.push(running + (waarde - input.vraagprijs));
    }
    return pts;
  }, [rendement.cashflowJaar1, waardestijging, input.vraagprijs]);

  const minVal = Math.min(0, ...chartData);
  const maxVal = Math.max(0, ...chartData);
  const range = maxVal - minVal || 1;
  const zeroY = 160 - ((0 - minVal) / range) * 160;

  const categorieColor = wws.categorie === 'Vrije sector'
    ? 'text-positive'
    : wws.categorie === 'Middenhuur'
      ? 'text-warning'
      : 'text-destructive';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left column */}
        <div className="space-y-4">
          {/* WWS Puntentelling inputs */}
          <div className="panel p-5 space-y-4">
            <div className={SECTION_HDR}>WWS Puntentelling — parameters</div>

            {/* Buitenruimte slider */}
            <div>
              <div className="text-sm mb-2 font-medium">
                Buitenruimte: <span className="text-navy font-bold">{buitenruimte} m²</span>
              </div>
              <input
                type="range"
                min={0}
                max={50}
                step={1}
                value={buitenruimte}
                onChange={e => setBuitenruimte(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                <span>0 m²</span>
                <span>50 m²</span>
              </div>
            </div>

            {/* Aanrecht toggle */}
            <div className="flex items-center justify-between">
              <span className="text-sm">Aanrechtlengte</span>
              <button
                type="button"
                onClick={() => setAanrechtGroot(!aanrechtGroot)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  aanrechtGroot
                    ? 'bg-navy text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {aanrechtGroot ? '≥200 cm (6 pt)' : '<200 cm (4 pt)'}
              </button>
            </div>
          </div>

          {/* Rendement inputs */}
          <div className="panel p-5 space-y-4">
            <div className={SECTION_HDR}>Verhuurparameters</div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Maandhuur (€) — Max WWS: {fmtEUR(wws.maxHuur)}/mnd
              </label>
              <input
                type="number"
                value={maandhuur}
                onChange={e => setMaandhuur(Number(e.target.value) || 0)}
                min={0}
                className={INPUT_CLS}
              />
            </div>

            <div>
              <div className="text-sm mb-2 font-medium">
                Leegstand: <span className="text-navy font-bold">{leegstand}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={15}
                step={0.5}
                value={leegstand}
                onChange={e => setLeegstand(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                <span>0%</span>
                <span>15%</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Jaarlijkse kosten (€)</label>
              <input
                type="number"
                value={jaarkosten}
                onChange={e => setJaarkosten(Number(e.target.value) || 0)}
                min={0}
                className={INPUT_CLS}
              />
            </div>

            <div>
              <div className="text-sm mb-2 font-medium">
                Waardestijging: <span className="text-navy font-bold">{waardestijging}% p.j.</span>
              </div>
              <input
                type="range"
                min={0}
                max={5}
                step={0.5}
                value={waardestijging}
                onChange={e => setWaardestijging(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                <span>0%</span>
                <span>5%</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Eigen inbreng (€)</label>
              <input
                type="number"
                value={eigenInbreng}
                onChange={e => setEigenInbreng(Number(e.target.value) || 0)}
                min={0}
                className={INPUT_CLS}
              />
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Rendement metrics */}
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              label="BAR (bruto)"
              value={fmtPct(rendement.bar)}
              color={rendement.bar >= 5 ? 'text-positive' : rendement.bar >= 3 ? 'text-warning' : 'text-destructive'}
            />
            <MetricCard
              label="NAR (netto)"
              value={fmtPct(rendement.nar)}
              color={rendement.nar >= 3 ? 'text-positive' : rendement.nar >= 1.5 ? 'text-warning' : 'text-destructive'}
            />
            <MetricCard
              label="Cash-on-cash"
              value={fmtPct(rendement.cashOnCash)}
              color={rendement.cashOnCash >= 5 ? 'text-positive' : rendement.cashOnCash >= 2 ? 'text-warning' : 'text-destructive'}
            />
            <MetricCard
              label="Terugverdientijd"
              value={`${rendement.terugverdien.toFixed(1)} jr`}
              color={rendement.terugverdien <= 15 ? 'text-positive' : rendement.terugverdien <= 25 ? 'text-warning' : 'text-destructive'}
            />
          </div>

          {/* Rendement breakdown */}
          <div className="panel p-5 space-y-2">
            <div className={SECTION_HDR}>Rendement berekening</div>
            <Line k="Maandhuur" v={fmtEUR(maandhuur)} />
            <Line k="× 12 maanden" v={fmtEUR(maandhuur * 12)} />
            <Line
              k={`× (1 − ${leegstand}% leegstand)`}
              v={fmtEUR(rendement.jaarhuurEffectief)}
              color="text-positive"
              bold
            />
            <Line k="− Jaarkosten" v={`− ${fmtEUR(jaarkosten)}`} color="text-destructive" />
            <div className="border-t border-border pt-2">
              <Line
                k="= Cashflow jaar 1"
                v={fmtEUR(rendement.cashflowJaar1)}
                bold
                color={rendement.cashflowJaar1 >= 0 ? 'text-positive' : 'text-destructive'}
              />
            </div>
          </div>

          {/* SVG Cashflow chart */}
          <div className="panel p-5">
            <div className={SECTION_HDR}>Cumulatieve cashflow + waardestijging (10 jaar)</div>
            <svg viewBox="0 0 400 160" className="w-full h-40">
              {/* Zero line */}
              <line
                x1="0" x2="400"
                y1={zeroY} y2={zeroY}
                stroke="var(--border)"
                strokeDasharray="4 2"
              />
              {/* Line */}
              <polyline
                fill="none"
                stroke="var(--primary)"
                strokeWidth="2"
                points={chartData
                  .map((v, i) => `${(i / 9) * 380 + 10},${160 - ((v - minVal) / range) * 150 + 5}`)
                  .join(' ')}
              />
              {/* Circles */}
              {chartData.map((v, i) => {
                const x = (i / 9) * 380 + 10;
                const y = 160 - ((v - minVal) / range) * 150 + 5;
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r="3"
                    fill={v >= 0 ? 'var(--positive)' : 'var(--destructive)'}
                  />
                );
              })}
            </svg>
            <div className="text-xs text-muted-foreground tabular flex justify-between mt-1">
              <span>Jaar 1</span>
              <span>Jaar 10: {fmtEUR(chartData[chartData.length - 1])}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: WWS Breakdown */}
      <div className="panel p-5">
        <div className={SECTION_HDR}>WWS Puntentelling — detail</div>
        <div className="space-y-1.5">
          <div className="grid grid-cols-[1fr,auto,auto] gap-2 text-sm">
            <span className="text-muted-foreground">m² ({input.woonoppervlakte} m² × 1,0 pt)</span>
            <span className="tabular text-right">=</span>
            <span className="tabular text-right font-medium">{wws.m2Punten.toFixed(0)} punten</span>
          </div>
          <div className="grid grid-cols-[1fr,auto,auto] gap-2 text-sm">
            <span className="text-muted-foreground">Energielabel ({input.energielabel})</span>
            <span className="tabular text-right">=</span>
            <span className="tabular text-right font-medium">{wws.energiePunten} punten</span>
          </div>
          <div className="grid grid-cols-[1fr,auto,auto] gap-2 text-sm">
            <span className="text-muted-foreground">WOZ per m² ratio</span>
            <span className="tabular text-right">=</span>
            <span className="tabular text-right font-medium">{wws.wozPunten} punten</span>
          </div>
          <div className="grid grid-cols-[1fr,auto,auto] gap-2 text-sm">
            <span className="text-muted-foreground">Buitenruimte ({buitenruimte} m²)</span>
            <span className="tabular text-right">=</span>
            <span className="tabular text-right font-medium">{wws.buitenPunten} punten</span>
          </div>
          <div className="grid grid-cols-[1fr,auto,auto] gap-2 text-sm">
            <span className="text-muted-foreground">Aanrecht ({aanrechtGroot ? '≥200 cm' : '<200 cm'})</span>
            <span className="tabular text-right">=</span>
            <span className="tabular text-right font-medium">{wws.aanrechtPunten} punten</span>
          </div>
          <div className="grid grid-cols-[1fr,auto,auto] gap-2 text-sm">
            <span className="text-muted-foreground">Toiletten ({toiletten} × 3)</span>
            <span className="tabular text-right">=</span>
            <span className="tabular text-right font-medium">{wws.toiletPunten} punten</span>
          </div>
          <div className="grid grid-cols-[1fr,auto,auto] gap-2 text-sm">
            <span className="text-muted-foreground">Badkamers ({badkamers} × 6)</span>
            <span className="tabular text-right">=</span>
            <span className="tabular text-right font-medium">{wws.badkamerPunten} punten</span>
          </div>
          <div className="border-t border-border pt-2 mt-2 grid grid-cols-[1fr,auto,auto] gap-2 text-sm font-bold">
            <span className="text-navy">Totaal</span>
            <span className="tabular text-right">=</span>
            <span className="tabular text-right text-navy">
              {wws.totaal} punten → Max huur {fmtEUR(wws.maxHuur)}/mnd
            </span>
          </div>
          <div className="mt-1 text-sm">
            <span className="text-muted-foreground">Categorie: </span>
            <span className={`font-semibold ${categorieColor}`}>{wws.categorie}</span>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">Indicatief — geen officieel WWS-instrument. Puntentelling per 2024/2025.</p>
      </div>

      {/* CBS Buurtcontext */}
      {(kad.cbsPctHuur != null || kad.cbsGemInkomen || kad.cbsGemWoningWaarde) && (
        <div className="panel p-5">
          <div className={SECTION_HDR}>Buurtcontext — CBS data</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {kad.cbsPctHuur != null && (
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">% Huurwoningen</div>
                <div className={`text-xl font-extrabold tabular ${kad.cbsPctHuur >= 40 ? 'text-positive' : kad.cbsPctHuur >= 20 ? 'text-warning' : 'text-navy'}`}>
                  {kad.cbsPctHuur}%
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {kad.cbsPctHuur >= 40 ? 'Sterk verhuurmarkt' : kad.cbsPctHuur >= 20 ? 'Gemengde markt' : 'Weinig huurders'}
                </div>
              </div>
            )}
            {kad.cbsPctKoop != null && (
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">% Koopwoningen</div>
                <div className="text-xl font-extrabold tabular text-navy">{kad.cbsPctKoop}%</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Buurtsamenstelling</div>
              </div>
            )}
            {kad.cbsGemInkomen && (
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">Gem. inkomen buurt</div>
                <div className="text-xl font-extrabold tabular text-navy">€{kad.cbsGemInkomen.toLocaleString('nl-NL')}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Per jaar per inwoner</div>
              </div>
            )}
            {kad.cbsGemWoningWaarde && (
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">Gem. woningwaarde</div>
                <div className="text-xl font-extrabold tabular text-navy">€{(kad.cbsGemWoningWaarde / 1000).toFixed(0)}k</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">CBS buurtstatistiek</div>
              </div>
            )}
            {kad.gemKoopsomBuurt && (
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">Gem. koopsom buurt</div>
                <div className="text-xl font-extrabold tabular text-navy">€{(kad.gemKoopsomBuurt / 1000).toFixed(0)}k</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {kad.koopsomAantal ? `${kad.koopsomAantal} transacties (Kadaster)` : 'Kadaster data'}
                </div>
              </div>
            )}
          </div>
          {kad.cbsPctHuur != null && (
            <p className="text-[11px] text-muted-foreground/60 mt-3">
              Een hogere huurquote in de buurt duidt op een actieve verhuurmarkt en potentieel hogere huurvraag.
              Bron: CBS Wijken &amp; Buurten.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
