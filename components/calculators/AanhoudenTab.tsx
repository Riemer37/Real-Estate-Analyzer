'use client';

import { useState, useMemo } from 'react';
import type { PropertyInput, KadasterInfo } from '@/lib/calc-types';
import { fmtEUR } from '@/lib/calculations';

// ── SVG Waardecurve ────────────────────────────────────────────────────────────
function WaardeCurve({
  aankoopprijs,
  groei,
  looptijd,
  verhuur,
  nettoCashflowJr,
  totaalInvestering,
}: {
  aankoopprijs: number;
  groei: number;
  looptijd: number;
  verhuur: boolean;
  nettoCashflowJr: number;
  totaalInvestering: number;
}) {
  const W = 600; const H = 200; const PAD = 48;
  const jaren = Math.min(looptijd, 30);

  const punten = Array.from({ length: jaren + 1 }, (_, i) => {
    const waarde = aankoopprijs * Math.pow(1 + groei / 100, i);
    const cashflow = verhuur ? nettoCashflowJr * i : 0;
    return { jaar: i, waarde, netto: waarde + cashflow - totaalInvestering };
  });

  const maxWaarde = Math.max(...punten.map(p => p.waarde));
  const minNetto  = Math.min(...punten.map(p => p.netto), 0);
  const maxNetto  = Math.max(...punten.map(p => p.netto));
  const maxY = Math.max(maxWaarde, totaalInvestering) * 1.05;
  const minY = Math.min(minNetto, 0);
  const range = maxY - minY;

  const toX = (jaar: number) => PAD + ((W - PAD * 2) * jaar) / jaren;
  const toY = (val: number)  => H - PAD - ((val - minY) / range) * (H - PAD * 1.5);

  const waardePath = punten.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.jaar).toFixed(1)},${toY(p.waarde).toFixed(1)}`).join(' ');
  const nettoPad   = punten.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.jaar).toFixed(1)},${toY(p.netto).toFixed(1)}`).join(' ');
  const nulY = toY(0);
  const invY = toY(totaalInvestering);

  const tickJaren = jaren <= 10 ? punten.map(p => p.jaar) : [0, 5, 10, 15, 20, 25, 30].filter(j => j <= jaren);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-40 sm:h-52">
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map(t => {
        const y = PAD + t * (H - PAD * 1.5);
        const val = maxY - t * range;
        return (
          <g key={t}>
            <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="currentColor" strokeOpacity={0.08} strokeWidth={1} />
            <text x={PAD - 4} y={y + 4} textAnchor="end" fontSize={9} fill="currentColor" opacity={0.4}>
              {val >= 1_000_000 ? (val / 1_000_000).toFixed(1) + 'M' : val >= 1000 ? Math.round(val / 1000) + 'k' : Math.round(val)}
            </text>
          </g>
        );
      })}

      {/* Nul-lijn */}
      {minY < 0 && <line x1={PAD} y1={nulY} x2={W - PAD} y2={nulY} stroke="#94a3b8" strokeDasharray="4 3" strokeWidth={1} />}

      {/* Investering lijn */}
      <line x1={PAD} y1={invY} x2={W - PAD} y2={invY} stroke="#6366f1" strokeDasharray="3 3" strokeWidth={1} opacity={0.5} />
      <text x={W - PAD + 2} y={invY + 3} fontSize={8} fill="#6366f1" opacity={0.7}>Inv.</text>

      {/* Waarde lijn */}
      <path d={waardePath} fill="none" stroke="#1e3a5f" strokeWidth={2} strokeLinejoin="round" />

      {/* Netto opbrengst lijn */}
      <path d={nettoPad} fill="none" stroke="#22c55e" strokeWidth={1.5} strokeDasharray="5 2" strokeLinejoin="round" />

      {/* X-as labels */}
      {tickJaren.map(j => (
        <text key={j} x={toX(j)} y={H - 6} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.5}>
          {j}j
        </text>
      ))}

      {/* Legenda */}
      <g>
        <line x1={PAD} y1={H - 36} x2={PAD + 16} y2={H - 36} stroke="#1e3a5f" strokeWidth={2} />
        <text x={PAD + 20} y={H - 32} fontSize={9} fill="currentColor" opacity={0.6}>Waarde</text>
        <line x1={PAD + 70} y1={H - 36} x2={PAD + 86} y2={H - 36} stroke="#22c55e" strokeWidth={1.5} strokeDasharray="5 2" />
        <text x={PAD + 90} y={H - 32} fontSize={9} fill="currentColor" opacity={0.6}>Netto opbrengst</text>
      </g>
    </svg>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function cagr(history: { jaar: number; waarde: number }[]): number | null {
  if (history.length < 2) return null;
  const sorted = [...history].sort((a, b) => a.jaar - b.jaar);
  const first = sorted[0];
  const last  = sorted[sorted.length - 1];
  const years = last.jaar - first.jaar;
  if (years <= 0 || first.waarde <= 0) return null;
  return (Math.pow(last.waarde / first.waarde, 1 / years) - 1) * 100;
}

function projected(base: number, groei: number, jaren: number) {
  return base * Math.pow(1 + groei / 100, jaren);
}

function fmt(n: number) { return fmtEUR(n); }
function fmtPct(n: number) { return n.toFixed(1) + '%'; }

const HORIZONS = [5, 10, 15, 20];

const ALTERNATIEVEN = [
  { label: 'Spaarrekening', groei: 2.0, kleur: 'text-muted-foreground' },
  { label: 'Obligaties',    groei: 4.0, kleur: 'text-muted-foreground' },
  { label: 'Aandelen (gem.)', groei: 7.0, kleur: 'text-muted-foreground' },
];

// ── Component ──────────────────────────────────────────────────────────────────

export default function AanhoudenTab({ input, kad }: { input: PropertyInput; kad: KadasterInfo }) {
  const historischCagr = useMemo(() => cagr(kad.wozHistory), [kad.wozHistory]);

  const [groei,       setGroei]       = useState<number>(historischCagr ? parseFloat(historischCagr.toFixed(1)) : 3.0);
  const [looptijd,    setLooptijd]    = useState<number>(10);
  const [verhuur,     setVerhuur]     = useState<boolean>(!!(input.huidigeHuurprijs || input.verwachteHuurprijs));
  const [maandhuur,   setMaandhuur]   = useState<number>(input.huidigeHuurprijs ?? input.verwachteHuurprijs ?? 0);
  const [vasteLasten, setVasteLasten] = useState<number>(input.vasteLastenPerMaand ?? 0);

  const aankoopprijs  = input.vraagprijs;
  const aankoopkosten = (input.eigenGebruik ? 0.02 : 0.104) * aankoopprijs
    + input.notariskosten + input.taxatiekosten + input.bouwkundigeKeuring + input.overigeKosten;
  const totaalInvestering = aankoopprijs + aankoopkosten;

  // Verkoopkosten bij exit (makelaar ~1,5% + notaris)
  const verkoopkosten = aankoopprijs * 0.015 + 1500;

  function berekenHorizon(jaren: number) {
    const verkoopwaarde   = projected(aankoopprijs, groei, jaren);
    const waardestijging  = verkoopwaarde - aankoopprijs;
    const nettoVerkoopw   = verkoopwaarde - verkoopkosten;

    const jaarhuur        = verhuur ? maandhuur * 12 : 0;
    const jaarlasten      = verhuur ? vasteLasten * 12 : 0;
    const nettoCashflowJr = jaarhuur - jaarlasten;
    const totaleCashflow  = nettoCashflowJr * jaren;

    const nettoOpbrengst  = nettoVerkoopw + totaleCashflow - totaalInvestering;
    const totalRoi        = (nettoOpbrengst / totaalInvestering) * 100;
    const jaarlijksRoi    = (Math.pow(1 + totalRoi / 100, 1 / jaren) - 1) * 100;

    return {
      jaren,
      verkoopwaarde,
      waardestijging,
      nettoVerkoopw,
      totaleCashflow,
      nettoCashflowJr,
      nettoOpbrengst,
      totalRoi,
      jaarlijksRoi,
    };
  }

  const hoofdScenario = useMemo(() => berekenHorizon(looptijd), [groei, looptijd, verhuur, maandhuur, vasteLasten, aankoopprijs]);
  const alleHorizons  = useMemo(() => HORIZONS.map(berekenHorizon),  [groei, looptijd, verhuur, maandhuur, vasteLasten, aankoopprijs]);

  return (
    <div className="space-y-6">

      {/* ── Instellingen ── */}
      <div className="panel p-5 space-y-5">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Instellingen</div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Groeivoet */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-foreground">Jaarlijkse waardestijging</label>
              <span className="text-lg font-extrabold text-navy tabular">{fmtPct(groei)}</span>
            </div>
            <input type="range" min={0} max={10} step={0.1} value={groei}
              onChange={e => setGroei(parseFloat(e.target.value))}
              className="w-full accent-navy" />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0%</span>
              {historischCagr !== null && (
                <button type="button" onClick={() => setGroei(parseFloat(historischCagr.toFixed(1)))}
                  className="text-navy hover:underline">
                  WOZ-historisch: {fmtPct(historischCagr)}
                </button>
              )}
              <span>10%</span>
            </div>
          </div>

          {/* Looptijd */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-foreground">Aanhoudperiode</label>
              <span className="text-lg font-extrabold text-navy tabular">{looptijd} jaar</span>
            </div>
            <input type="range" min={1} max={30} step={1} value={looptijd}
              onChange={e => setLooptijd(parseInt(e.target.value))}
              className="w-full accent-navy" />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>1 jaar</span>
              <span>30 jaar</span>
            </div>
          </div>
        </div>

        {/* Verhuur toggle */}
        <div className="border-t border-border pt-4 space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={verhuur} onChange={e => setVerhuur(e.target.checked)}
              className="accent-navy size-4" />
            <span className="text-sm font-semibold">Pand wordt verhuurd tijdens aanhoudperiode</span>
          </label>

          {verhuur && (
            <div className="grid grid-cols-2 gap-4 pl-7">
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Huurprijs / maand</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
                  <input type="number" value={maandhuur || ''} onChange={e => setMaandhuur(Number(e.target.value))}
                    className="input-base w-full pl-7 text-sm" placeholder="0" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Vaste lasten / maand</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
                  <input type="number" value={vasteLasten || ''} onChange={e => setVasteLasten(Number(e.target.value))}
                    className="input-base w-full pl-7 text-sm" placeholder="0" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Hoofdresultaat ── */}
      <div className="panel p-5">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-4">
          Scenario: {looptijd} jaar aanhouden
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
          <div className="text-center">
            <div className="text-[11px] text-muted-foreground mb-1">Geschatte waarde</div>
            <div className="text-xl font-extrabold text-navy tabular">{fmt(hoofdScenario.verkoopwaarde)}</div>
          </div>
          <div className="text-center">
            <div className="text-[11px] text-muted-foreground mb-1">Waardestijging</div>
            <div className={`text-xl font-extrabold tabular ${hoofdScenario.waardestijging >= 0 ? 'text-positive' : 'text-destructive'}`}>
              {fmt(hoofdScenario.waardestijging)}
            </div>
          </div>
          {verhuur && (
            <div className="text-center">
              <div className="text-[11px] text-muted-foreground mb-1">Totale cashflow</div>
              <div className={`text-xl font-extrabold tabular ${hoofdScenario.totaleCashflow >= 0 ? 'text-positive' : 'text-destructive'}`}>
                {fmt(hoofdScenario.totaleCashflow)}
              </div>
            </div>
          )}
          <div className="text-center">
            <div className="text-[11px] text-muted-foreground mb-1">Netto opbrengst</div>
            <div className={`text-xl font-extrabold tabular ${hoofdScenario.nettoOpbrengst >= 0 ? 'text-positive' : 'text-destructive'}`}>
              {fmt(hoofdScenario.nettoOpbrengst)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-border pt-4 text-sm">
          <div>
            <span className="text-muted-foreground text-xs">Totale ROI</span>
            <div className={`font-bold tabular ${hoofdScenario.totalRoi >= 0 ? 'text-positive' : 'text-destructive'}`}>
              {fmtPct(hoofdScenario.totalRoi)}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Jaarlijks rendement</span>
            <div className={`font-bold tabular ${hoofdScenario.jaarlijksRoi >= 0 ? 'text-positive' : 'text-destructive'}`}>
              {fmtPct(hoofdScenario.jaarlijksRoi)}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Totale investering</span>
            <div className="font-semibold tabular">{fmt(totaalInvestering)}</div>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Netto verkoopwaarde</span>
            <div className="font-semibold tabular">{fmt(hoofdScenario.nettoVerkoopw)}</div>
          </div>
        </div>
      </div>

      {/* ── Waardecurve ── */}
      <div className="panel p-5">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3">
          Waardeontwikkeling over {Math.min(looptijd, 30)} jaar
        </div>
        <WaardeCurve
          aankoopprijs={aankoopprijs}
          groei={groei}
          looptijd={looptijd}
          verhuur={verhuur}
          nettoCashflowJr={hoofdScenario.nettoCashflowJr}
          totaalInvestering={totaalInvestering}
        />
      </div>

      {/* ── Vergelijkingstabel ── */}
      <div className="panel p-5">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3">Vergelijking per horizon</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 text-xs font-semibold text-muted-foreground">Horizon</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Waarde</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Stijging</th>
                {verhuur && <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Cashflow</th>}
                <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Netto</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">ROI/jr</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {alleHorizons.map(h => {
                const isActive = h.jaren === looptijd;
                return (
                  <tr key={h.jaren}
                    className={`cursor-pointer transition-colors ${isActive ? 'bg-navy/5' : 'hover:bg-muted'}`}
                    onClick={() => setLooptijd(h.jaren)}>
                    <td className={`py-2 pr-4 font-semibold ${isActive ? 'text-navy' : ''}`}>{h.jaren} jaar</td>
                    <td className="py-2 px-3 text-right tabular">{fmt(h.verkoopwaarde)}</td>
                    <td className={`py-2 px-3 text-right tabular ${h.waardestijging >= 0 ? 'text-positive' : 'text-destructive'}`}>
                      {fmt(h.waardestijging)}
                    </td>
                    {verhuur && (
                      <td className={`py-2 px-3 text-right tabular ${h.totaleCashflow >= 0 ? 'text-positive' : 'text-destructive'}`}>
                        {fmt(h.totaleCashflow)}
                      </td>
                    )}
                    <td className={`py-2 px-3 text-right tabular font-semibold ${h.nettoOpbrengst >= 0 ? 'text-positive' : 'text-destructive'}`}>
                      {fmt(h.nettoOpbrengst)}
                    </td>
                    <td className={`py-2 px-3 text-right tabular ${h.jaarlijksRoi >= 0 ? 'text-positive' : 'text-destructive'}`}>
                      {fmtPct(h.jaarlijksRoi)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">Klik op een rij om de aanhoudperiode in te stellen.</p>
      </div>

      {/* ── Vergelijking met alternatieven ── */}
      <div className="panel p-5">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3">
          Vergelijking met alternatieve beleggingen ({looptijd} jaar)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 text-xs font-semibold text-muted-foreground">Belegging</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Rendement/jr</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Eindwaarde</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Netto winst</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {/* Vastgoed (dit pand) */}
              <tr className="bg-navy/5">
                <td className="py-2 pr-4 font-semibold text-navy">Dit pand</td>
                <td className="py-2 px-3 text-right tabular font-semibold text-navy">{fmtPct(hoofdScenario.jaarlijksRoi)}</td>
                <td className="py-2 px-3 text-right tabular font-semibold text-navy">
                  {fmt(hoofdScenario.nettoVerkoopw + (verhuur ? hoofdScenario.totaleCashflow : 0))}
                </td>
                <td className={`py-2 px-3 text-right tabular font-semibold ${hoofdScenario.nettoOpbrengst >= 0 ? 'text-positive' : 'text-destructive'}`}>
                  {fmt(hoofdScenario.nettoOpbrengst)}
                </td>
              </tr>
              {ALTERNATIEVEN.map(alt => {
                const eindwaarde = projected(totaalInvestering, alt.groei, looptijd);
                const winst      = eindwaarde - totaalInvestering;
                const beter      = hauptScenario_beter(hoofdScenario.nettoOpbrengst, winst);
                return (
                  <tr key={alt.label}>
                    <td className="py-2 pr-4 text-muted-foreground">{alt.label}</td>
                    <td className="py-2 px-3 text-right tabular text-muted-foreground">{fmtPct(alt.groei)}</td>
                    <td className="py-2 px-3 text-right tabular">{fmt(eindwaarde)}</td>
                    <td className={`py-2 px-3 text-right tabular ${beter ? 'text-muted-foreground' : 'text-destructive'}`}>
                      {fmt(winst)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Alternatieve beleggingen berekend op basis van totale investering ({fmt(totaalInvestering)}) zonder belasting.
        </p>
      </div>

      {/* ── WOZ-trend ── */}
      {kad.wozHistory.length >= 2 && (
        <div className="panel p-5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3">
            Historische WOZ-waarde ({historischCagr !== null ? `gem. ${fmtPct(historischCagr)}/jr` : ''})
          </div>
          <div className="space-y-2">
            {[...kad.wozHistory].sort((a, b) => b.jaar - a.jaar).map((w, i, arr) => {
              const prev   = arr[i + 1];
              const change = prev ? ((w.waarde - prev.waarde) / prev.waarde) * 100 : null;
              return (
                <div key={w.jaar} className="flex items-center gap-3 text-sm">
                  <span className="w-12 text-muted-foreground tabular">{w.jaar}</span>
                  <span className="font-semibold tabular w-28">{fmt(w.waarde)}</span>
                  {change !== null && (
                    <span className={`text-xs tabular ${change >= 0 ? 'text-positive' : 'text-destructive'}`}>
                      {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function hauptScenario_beter(vastgoedNetto: number, altNetto: number): boolean {
  return vastgoedNetto >= altNetto;
}
