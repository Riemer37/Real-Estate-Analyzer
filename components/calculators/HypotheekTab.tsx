'use client';

import { useState, useMemo } from 'react';
import type { PropertyInput } from '@/lib/calc-types';
import { fmtEUR } from '@/lib/calculations';

const NHG_GRENS = 435_000;
const VRIJE_SECTOR_GRENS = 879;

function fmt(n: number) { return fmtEUR(n); }
function fmtPct(n: number, d = 2) { return n.toFixed(d) + '%'; }

function berekenAnnuitair(principal: number, jaarRente: number, jaren: number) {
  const r = jaarRente / 100 / 12;
  const n = jaren * 12;
  if (r === 0) return principal / n;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function maandstaten(principal: number, jaarRente: number, jaren: number, type: 'annuitair' | 'lineair') {
  const r = jaarRente / 100 / 12;
  const n = jaren * 12;
  const rows: { maand: number; rente: number; aflossing: number; maandlast: number; restschuld: number }[] = [];
  let restschuld = principal;

  const vaste = type === 'annuitair' ? berekenAnnuitair(principal, jaarRente, jaren) : 0;
  const lineaireAflossing = principal / n;

  for (let i = 1; i <= n; i++) {
    const rente = restschuld * r;
    const aflossing = type === 'annuitair' ? vaste - rente : lineaireAflossing;
    const maandlast = rente + aflossing;
    restschuld = Math.max(0, restschuld - aflossing);
    rows.push({ maand: i, rente, aflossing, maandlast, restschuld });
  }
  return rows;
}

export default function HypotheekTab({ input }: { input: PropertyInput }) {
  const aankoopprijs = input.vraagprijs;

  const [eigenInbreng,  setEigenInbreng]  = useState<number>(Math.round(aankoopprijs * 0.2));
  const [rente,         setRente]         = useState<number>(4.0);
  const [looptijd,      setLooptijd]      = useState<number>(30);
  const [type,          setType]          = useState<'annuitair' | 'lineair'>('annuitair');
  const [toonAflosplan, setToonAflosplan] = useState<boolean>(false);

  const hypotheekbedrag = Math.max(0, aankoopprijs - eigenInbreng);
  const ltv = aankoopprijs > 0 ? (hypotheekbedrag / aankoopprijs) * 100 : 0;
  const nhgMogelijk = aankoopprijs <= NHG_GRENS && ltv <= 100;

  const ovbBedrag = aankoopprijs * (input.eigenGebruik ? 0.02 : 0.104);
  const bijkomend  = ovbBedrag + input.notariskosten + input.taxatiekosten + input.bouwkundigeKeuring + input.overigeKosten;

  const maandlastAnnuitair = useMemo(
    () => hypotheekbedrag > 0 ? berekenAnnuitair(hypotheekbedrag, rente, looptijd) : 0,
    [hypotheekbedrag, rente, looptijd]
  );

  const rows = useMemo(
    () => hypotheekbedrag > 0 ? maandstaten(hypotheekbedrag, rente, looptijd, type) : [],
    [hypotheekbedrag, rente, looptijd, type]
  );

  const eersteJaarRows = rows.slice(0, 12);
  const maandlast = rows[0]?.maandlast ?? 0;
  const totaalRente = rows.reduce((s, r) => s + r.rente, 0);
  const totaalBetaald = rows.reduce((s, r) => s + r.maandlast, 0);

  // Huurrendement check
  const huurpermaand = input.verwachteHuurprijs ?? input.huidigeHuurprijs ?? 0;
  const cashflowPerMaand = huurpermaand - maandlast - (input.vasteLastenPerMaand ?? 0);

  // Jaarlijkse rente — jaar 1, 5, 10, 20
  const snapshots = [1, 5, 10, 20, looptijd].filter(j => j <= looptijd).map(jaar => {
    const idx = jaar * 12 - 1;
    return { jaar, restschuld: rows[idx]?.restschuld ?? 0, totaalBetaaldTot: rows.slice(0, idx + 1).reduce((s, r) => s + r.maandlast, 0) };
  });

  return (
    <div className="space-y-6">

      {/* ── Instellingen ── */}
      <div className="panel p-5 space-y-5">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Hypotheekinstellingen</div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Eigen inbreng */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-semibold">Eigen inbreng</label>
              <span className="text-sm font-bold text-navy tabular">{fmt(eigenInbreng)} ({fmtPct(eigenInbreng / aankoopprijs * 100, 0)})</span>
            </div>
            <input type="range" min={0} max={aankoopprijs} step={1000} value={eigenInbreng}
              onChange={e => setEigenInbreng(Number(e.target.value))} className="w-full accent-navy" />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>€0</span>
              <span>{fmt(aankoopprijs)}</span>
            </div>
          </div>

          {/* Rente */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-semibold">Rentepercentage</label>
              <span className="text-sm font-bold text-navy tabular">{fmtPct(rente)}</span>
            </div>
            <input type="range" min={1} max={10} step={0.05} value={rente}
              onChange={e => setRente(parseFloat(e.target.value))} className="w-full accent-navy" />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>1%</span>
              <span className="text-navy cursor-pointer hover:underline" onClick={() => setRente(4.0)}>Reset 4%</span>
              <span>10%</span>
            </div>
          </div>

          {/* Looptijd */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-semibold">Looptijd</label>
              <span className="text-sm font-bold text-navy tabular">{looptijd} jaar</span>
            </div>
            <input type="range" min={5} max={30} step={1} value={looptijd}
              onChange={e => setLooptijd(Number(e.target.value))} className="w-full accent-navy" />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>5 jaar</span>
              <span>30 jaar</span>
            </div>
          </div>

          {/* Type */}
          <div className="space-y-2">
            <label className="text-sm font-semibold block">Hypotheekvorm</label>
            <div className="flex gap-2">
              {(['annuitair', 'lineair'] as const).map(t => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={`flex-1 py-2 rounded-md text-sm font-semibold border transition-colors ${
                    type === t ? 'bg-navy text-white border-navy' : 'bg-background border-border text-muted-foreground hover:border-navy/40'
                  }`}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {type === 'annuitair'
                ? 'Gelijke maandlast — meer rente in begin, meer aflossing later.'
                : 'Gelijke aflossing — dalende maandlast over de tijd.'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Kerngetallen ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Hypotheekbedrag',  value: fmt(hypotheekbedrag),         sub: `LTV ${fmtPct(ltv, 0)}` },
          { label: 'Maandlast (mnd 1)', value: fmt(maandlast),               sub: type === 'annuitair' ? 'Gelijkblijvend' : 'Daalt maandelijks' },
          { label: 'Totale rentekosten', value: fmt(totaalRente),             sub: `Over ${looptijd} jaar` },
          { label: 'Totaal betaald',    value: fmt(totaalBetaald),            sub: `Incl. aflossing` },
        ].map(({ label, value, sub }) => (
          <div key={label} className="panel p-4 text-center">
            <div className="text-[11px] text-muted-foreground mb-1">{label}</div>
            <div className="text-lg font-extrabold text-navy tabular">{value}</div>
            {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Financieringsoverzicht ── */}
      <div className="panel p-5">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-4">Financieringsoverzicht</div>
        <div className="space-y-2 text-sm">
          {[
            { k: 'Aankoopprijs',        v: fmt(aankoopprijs) },
            { k: 'Eigen inbreng',       v: fmt(eigenInbreng),      color: 'text-positive' },
            { k: 'Hypotheekbedrag',     v: fmt(hypotheekbedrag),   bold: true },
            null,
            { k: `OVB (${input.eigenGebruik ? '2%' : '10,4%'})`,  v: fmt(ovbBedrag) },
            { k: 'Notariskosten',       v: fmt(input.notariskosten) },
            { k: 'Taxatiekosten',       v: fmt(input.taxatiekosten) },
            { k: 'Bouwkundige keuring', v: fmt(input.bouwkundigeKeuring) },
            { k: 'Overige kosten',      v: fmt(input.overigeKosten) },
            null,
            { k: 'Totale bijkomende kosten', v: fmt(bijkomend), bold: true },
            { k: 'Totale investering',  v: fmt(aankoopprijs + bijkomend), bold: true, color: 'text-navy' },
          ].map((row, i) => row === null
            ? <div key={i} className="border-t border-border" />
            : (
              <div key={i} className={`flex justify-between ${row.bold ? 'font-semibold' : ''}`}>
                <span className="text-muted-foreground">{row.k}</span>
                <span className={`tabular ${row.color ?? ''}`}>{row.v}</span>
              </div>
            )
          )}
        </div>
      </div>

      {/* ── NHG & LTV ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={`panel p-4 border-l-4 ${nhgMogelijk ? 'border-l-positive' : 'border-l-muted'}`}>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">NHG (Nationale Hypotheek Garantie)</div>
          <div className={`text-sm font-semibold mb-1 ${nhgMogelijk ? 'text-positive' : 'text-muted-foreground'}`}>
            {nhgMogelijk ? 'Mogelijk van toepassing' : 'Niet van toepassing'}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {nhgMogelijk
              ? `Aankoopprijs (${fmt(aankoopprijs)}) valt onder de NHG-grens van ${fmt(NHG_GRENS)}. Voordeel: lagere rente (~0,4%) en garantie bij gedwongen verkoop. Controleer bij uw geldverstrekker.`
              : `Aankoopprijs (${fmt(aankoopprijs)}) overschrijdt de NHG-grens van ${fmt(NHG_GRENS)} of LTV > 100%.`
            }
          </p>
        </div>

        <div className={`panel p-4 border-l-4 ${ltv <= 80 ? 'border-l-positive' : ltv <= 100 ? 'border-l-warning' : 'border-l-destructive'}`}>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">LTV (Loan-to-Value)</div>
          <div className={`text-2xl font-extrabold tabular mb-1 ${ltv <= 80 ? 'text-positive' : ltv <= 100 ? 'text-warning' : 'text-destructive'}`}>
            {fmtPct(ltv, 1)}
          </div>
          <p className="text-xs text-muted-foreground">
            {ltv <= 80 ? 'Gunstig — banken bieden doorgaans de beste rente onder 80% LTV.'
              : ltv <= 100 ? 'Acceptabel — de meeste geldverstrekkers financieren tot 100% LTV.'
              : 'Te hoog — meer dan 100% LTV wordt in Nederland niet gefinancierd.'}
          </p>
        </div>
      </div>

      {/* ── Cashflow bij verhuur ── */}
      {huurpermaand > 0 && (
        <div className={`panel p-5 border-l-4 ${cashflowPerMaand >= 0 ? 'border-l-positive' : 'border-l-destructive'}`}>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3">Cashflow bij verhuur</div>
          <div className="space-y-2 text-sm">
            {[
              { k: 'Huurinkomsten/maand',  v: fmt(huurpermaand),          color: 'text-positive' },
              { k: 'Hypotheeklasten/maand', v: `-${fmt(maandlast)}`,       color: 'text-destructive' },
              { k: 'Vaste lasten/maand',    v: `-${fmt(input.vasteLastenPerMaand ?? 0)}`, color: 'text-destructive' },
              null,
              { k: 'Netto cashflow/maand',  v: fmt(cashflowPerMaand),      bold: true, color: cashflowPerMaand >= 0 ? 'text-positive' : 'text-destructive' },
              { k: 'Netto cashflow/jaar',   v: fmt(cashflowPerMaand * 12), bold: true, color: cashflowPerMaand >= 0 ? 'text-positive' : 'text-destructive' },
            ].map((row, i) => row === null
              ? <div key={i} className="border-t border-border" />
              : (
                <div key={i} className={`flex justify-between ${row.bold ? 'font-semibold' : ''}`}>
                  <span className="text-muted-foreground">{row.k}</span>
                  <span className={`tabular ${row.color ?? ''}`}>{row.v}</span>
                </div>
              )
            )}
          </div>
          {huurpermaand < VRIJE_SECTOR_GRENS && (
            <p className="mt-3 text-[11px] text-warning border-t border-border pt-2">
              Let op: huurprijs (€{huurpermaand}/mnd) valt onder de vrije sectorgrens (€{VRIJE_SECTOR_GRENS}/mnd) — sociale huurregels kunnen van toepassing zijn.
            </p>
          )}
        </div>
      )}

      {/* ── Restschuld snapshots ── */}
      <div className="panel p-5">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3">Restschuld & betaald per mijlpaal</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 text-xs font-semibold text-muted-foreground">Jaar</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Restschuld</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Afgelost</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Totaal betaald</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {snapshots.map(s => (
                <tr key={s.jaar}>
                  <td className="py-2 pr-4 font-semibold">Jaar {s.jaar}</td>
                  <td className="py-2 px-3 text-right tabular text-warning">{fmt(s.restschuld)}</td>
                  <td className="py-2 px-3 text-right tabular text-positive">{fmt(hypotheekbedrag - s.restschuld)}</td>
                  <td className="py-2 px-3 text-right tabular">{fmt(s.totaalBetaaldTot)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Aflossingsplan ── */}
      <div className="panel p-5">
        <button type="button" onClick={() => setToonAflosplan(!toonAflosplan)}
          className="flex items-center justify-between w-full text-left">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
            Volledig aflossingsplan (jaar 1)
          </div>
          <span className="text-xs text-navy">{toonAflosplan ? 'Verbergen ▲' : 'Tonen ▼'}</span>
        </button>
        {toonAflosplan && (
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1.5 pr-3 text-muted-foreground">Mnd</th>
                  <th className="text-right py-1.5 px-2 text-muted-foreground">Maandlast</th>
                  <th className="text-right py-1.5 px-2 text-muted-foreground">Rente</th>
                  <th className="text-right py-1.5 px-2 text-muted-foreground">Aflossing</th>
                  <th className="text-right py-1.5 px-2 text-muted-foreground">Restschuld</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {eersteJaarRows.map(r => (
                  <tr key={r.maand}>
                    <td className="py-1.5 pr-3 font-medium">{r.maand}</td>
                    <td className="py-1.5 px-2 text-right tabular font-semibold">{fmt(r.maandlast)}</td>
                    <td className="py-1.5 px-2 text-right tabular text-warning">{fmt(r.rente)}</td>
                    <td className="py-1.5 px-2 text-right tabular text-positive">{fmt(r.aflossing)}</td>
                    <td className="py-1.5 px-2 text-right tabular">{fmt(r.restschuld)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Indicatieve berekening. Neem altijd contact op met een hypotheekadviseur voor bindend advies. Tarieven en voorwaarden variëren per geldverstrekker.
      </p>
    </div>
  );
}
