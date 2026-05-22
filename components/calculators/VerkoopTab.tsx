'use client';

import { useState, useMemo } from 'react';
import { AlertTriangle, ExternalLink, Info } from 'lucide-react';
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

export default function VerkoopTab({ input, kad }: VerkoopTabProps) {
  // — Lokaal bewerkbaar: aankoopkosten —
  const [eigenGebruik,       setEigenGebruik]       = useState(input.eigenGebruik);
  const [renovatiePerM2,     setRenovatiePerM2]     = useState(input.renovatiekostenPerM2 ?? 0);
  const [notariskosten,      setNotariskosten]      = useState(input.notariskosten);
  const [taxatiekosten,      setTaxatiekosten]      = useState(input.taxatiekosten);
  const [bouwkundigeKeuring, setBouwkundigeKeuring] = useState(input.bouwkundigeKeuring);
  const [overigeKosten,      setOverigeKosten]      = useState(input.overigeKosten);
  // — Lokaal bewerkbaar: verkoopscenario —
  const [refPrijsPerM2,      setRefPrijsPerM2]      = useState(input.referentieprijsPerM2 ?? 0);
  const [makelaarPct,        setMakelaarPct]        = useState(1.5);
  const [vasteVerkoopkosten, setVasteVerkoopkosten] = useState(2500);
  // — ROI slider voor max bod back-calc —
  const [gewensteRoi,        setGewensteRoi]        = useState(15);

  const ovbPct          = eigenGebruik && input.typeWoning !== 'commercieel' ? 2 : 10.4;
  const renovatiekosten = Math.round(renovatiePerM2 * input.woonoppervlakte);
  const arv             = refPrijsPerM2 > 0 ? Math.round(refPrijsPerM2 * input.woonoppervlakte) : 0;

  const calc = useMemo(() => {
    const aankoopsom      = input.vraagprijs;
    const ovb             = Math.round(aankoopsom * (ovbPct / 100));
    const vasteKosten     = notariskosten + taxatiekosten + bouwkundigeKeuring + overigeKosten;
    const bijkomend       = ovb + vasteKosten;
    const totaalInv       = aankoopsom + renovatiekosten + bijkomend;
    const makelaarskosten = Math.round(arv * (makelaarPct / 100));
    const verkoopkosten   = makelaarskosten + vasteVerkoopkosten;
    const nettowinst      = arv - totaalInv - verkoopkosten;
    const roi             = totaalInv > 0 ? (nettowinst / totaalInv) * 100 : 0;
    const terugverdien    = nettowinst > 0 ? totaalInv / nettowinst : Infinity;

    // Max bod back-calc (ROI = nettowinst / totaalInvestering)
    // totaalInvTarget = (arv − verkoopkosten) / (1 + gewensteRoi/100)
    // maxVP           = (totaalInvTarget − vasteKosten − renovatiekosten) / (1 + ovbPct/100)
    const totaalInvTarget = arv > 0 ? (arv - verkoopkosten) / (1 + gewensteRoi / 100) : 0;
    const maxVP =
      arv > 0 && totaalInvTarget > vasteKosten + renovatiekosten
        ? Math.round(((totaalInvTarget - vasteKosten - renovatiekosten) / (1 + ovbPct / 100)) / 500) * 500
        : 0;
    const verschil    = maxVP - aankoopsom;
    const verschilPct = aankoopsom > 0 ? (verschil / aankoopsom) * 100 : 0;

    return {
      aankoopsom, ovb, bijkomend, totaalInv,
      makelaarskosten, verkoopkosten, nettowinst, roi, terugverdien,
      maxVP, verschil, verschilPct,
    };
  }, [
    arv, ovbPct, renovatiekosten, makelaarPct, vasteVerkoopkosten, gewensteRoi,
    notariskosten, taxatiekosten, bouwkundigeKeuring, overigeKosten,
    input.vraagprijs,
  ]);

  // Validaties
  const warnings: { msg: string }[] = [];
  if (refPrijsPerM2 > 0 && refPrijsPerM2 < 500)
    warnings.push({ msg: `Referentieprijs € ${refPrijsPerM2.toLocaleString('nl-NL')}/m² lijkt erg laag (< € 500/m²) — controleer.` });
  if (refPrijsPerM2 > 25000)
    warnings.push({ msg: `Referentieprijs € ${refPrijsPerM2.toLocaleString('nl-NL')}/m² is uitzonderlijk hoog (> € 25.000/m²) — controleer.` });
  if (renovatiePerM2 > 5000)
    warnings.push({ msg: `Verbouwingskosten € ${renovatiePerM2.toLocaleString('nl-NL')}/m² overschrijdt € 5.000/m² — luxe renovatie?` });

  // Funda verkocht link op basis van kadaster gemeente
  const gemeente = kad.gemeente?.toLowerCase().replace(/[\s/]+/g, '-') ?? '';
  const fundaUrl = gemeente ? `https://www.funda.nl/koop/verkocht/${encodeURIComponent(gemeente)}/` : null;

  // Waterfall segments
  const segments = [
    { label: 'Aankoop',    value: calc.aankoopsom,                color: '#3b82f6' },
    { label: 'Verbouwing', value: renovatiekosten,                color: '#f97316' },
    { label: 'Kosten',     value: calc.bijkomend + calc.verkoopkosten, color: '#94a3b8' },
    {
      label: calc.nettowinst >= 0 ? 'Winst' : 'Verlies',
      value: Math.abs(calc.nettowinst),
      color: calc.nettowinst >= 0 ? '#22c55e' : '#ef4444',
    },
  ];
  const chartMax = Math.max(arv, 1);

  return (
    <div className="space-y-4">

      {/* ── Invoer (2-col) ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Kosten & aankoop */}
        <div className="panel p-5 space-y-4">
          <div className={SECTION_HDR}>Kosten &amp; aankoop</div>

          {/* OVB toggle */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">OVB type</label>
            <div className="flex gap-2">
              {[
                { label: 'Eigen gebruik (2%)', val: true },
                { label: 'Belegging (10,4%)',  val: false },
              ].map(({ label, val }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setEigenGebruik(val)}
                  className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                    eigenGebruik === val
                      ? 'bg-primary text-white border-primary'
                      : 'bg-background border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground tabular">
              OVB op vraagprijs: {fmtEUR(calc.ovb)} ({ovbPct}%)
            </p>
          </div>

          {/* Verbouwingskosten */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Verbouwingskosten per m² (€)</label>
            <input
              type="number"
              value={renovatiePerM2 || ''}
              onChange={e => setRenovatiePerM2(Number(e.target.value) || 0)}
              min={0}
              placeholder="0"
              className={INPUT_CLS}
            />
            {renovatiePerM2 > 0 && (
              <p className="text-[11px] text-muted-foreground tabular">
                Totaal: € {renovatiePerM2.toLocaleString('nl-NL')} × {input.woonoppervlakte} m² = {fmtEUR(renovatiekosten)}
              </p>
            )}
          </div>

          {/* Bijkomende kosten 2×2 */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Bijkomende aankoopkosten (€)</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                ['Notariskosten',   notariskosten,      setNotariskosten],
                ['Taxatiekosten',   taxatiekosten,      setTaxatiekosten],
                ['Bouwk. keuring',  bouwkundigeKeuring, setBouwkundigeKeuring],
                ['Overige kosten',  overigeKosten,      setOverigeKosten],
              ] as const).map(([lbl, val, set]) => (
                <div key={lbl} className="space-y-0.5">
                  <label className="text-[11px] text-muted-foreground">{lbl}</label>
                  <input
                    type="number"
                    value={val || ''}
                    onChange={e => (set as (v: number) => void)(Number(e.target.value) || 0)}
                    min={0}
                    placeholder="0"
                    className={INPUT_CLS}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Verkoopscenario */}
        <div className="panel p-5 space-y-4">
          <div className={SECTION_HDR}>Verkoopscenario</div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Referentieprijs buurt (€ per m²)</label>
            <input
              type="number"
              value={refPrijsPerM2 || ''}
              onChange={e => setRefPrijsPerM2(Number(e.target.value) || 0)}
              min={0}
              placeholder="0"
              className={INPUT_CLS}
            />
            {refPrijsPerM2 > 0 && (
              <p className="text-[11px] text-muted-foreground tabular">
                ARV: € {refPrijsPerM2.toLocaleString('nl-NL')} × {input.woonoppervlakte} m² = {fmtEUR(arv)}
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
              value={vasteVerkoopkosten || ''}
              onChange={e => setVasteVerkoopkosten(Number(e.target.value) || 0)}
              min={0}
              className={INPUT_CLS}
            />
          </div>
        </div>
      </div>

      {/* ── Validaties ────────────────────────────────────────────────────── */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((w, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-sm rounded-md border px-3 py-2.5 bg-warning/10 border-warning/30 text-warning"
            >
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <span>{w.msg}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Berekeningen ──────────────────────────────────────────────────── */}
      {arv > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Stap-voor-stap */}
          <div className="panel p-5 space-y-2">
            <div className={SECTION_HDR}>Berekening stap voor stap</div>
            <div className="space-y-1">
              <Line k="Aankoopsom"              v={fmtEUR(calc.aankoopsom)} />
              <Line k="+ Verbouwingskosten"     v={`+ ${fmtEUR(renovatiekosten)}`}        color="text-warning" />
              <Line k={`+ OVB (${ovbPct}%)`}   v={`+ ${fmtEUR(calc.ovb)}`}               color="text-destructive" indent />
              <Line k="+ Notariskosten"         v={`+ ${fmtEUR(notariskosten)}`}           color="text-destructive" indent />
              <Line k="+ Taxatiekosten"         v={`+ ${fmtEUR(taxatiekosten)}`}           color="text-destructive" indent />
              <Line k="+ Bouwkundige keuring"   v={`+ ${fmtEUR(bouwkundigeKeuring)}`}      color="text-destructive" indent />
              {overigeKosten > 0 && (
                <Line k="+ Overige kosten"      v={`+ ${fmtEUR(overigeKosten)}`}           color="text-destructive" indent />
              )}
            </div>
            <div className="border-t border-border pt-2">
              <Line k="= Totaal investering" v={fmtEUR(calc.totaalInv)} bold />
            </div>
            <div className="pt-2 space-y-1">
              <Line k="Verkoopwaarde (ARV)"              v={fmtEUR(arv)}                          color="text-positive" />
              <Line k={`− Makelaarskosten (${makelaarPct.toFixed(1)}%)`} v={`− ${fmtEUR(calc.makelaarskosten)}`} color="text-destructive" />
              <Line k="− Vaste verkoopkosten"            v={`− ${fmtEUR(vasteVerkoopkosten)}`}    color="text-destructive" />
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

          {/* Metrics + ROI slider */}
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
                <div className="text-xl font-extrabold tabular text-navy">{fmtEUR(calc.totaalInv)}</div>
              </div>
              <div className="panel p-4">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">Terugverdientijd</div>
                <div className={`text-xl font-extrabold tabular ${calc.terugverdien <= 2 ? 'text-positive' : calc.terugverdien <= 5 ? 'text-warning' : 'text-destructive'}`}>
                  {calc.nettowinst > 0 ? `${calc.terugverdien.toFixed(1)} jr` : '—'}
                </div>
              </div>
            </div>

            {/* ROI slider + max bod verdict */}
            <div className="panel p-5 space-y-4">
              <div className={SECTION_HDR}>Maximale vraagprijs bij gewenste ROI</div>
              <div>
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

              <div className={`rounded-xl border-2 p-4 text-center space-y-1 ${
                calc.verschil < 0
                  ? 'border-destructive/40 bg-destructive/5'
                  : 'border-positive/40 bg-positive/5'
              }`}>
                <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                  Max vraagprijs bij {gewensteRoi}% ROI
                </p>
                <p className="text-2xl font-extrabold text-navy tabular">
                  {calc.maxVP > 0 ? fmtEUR(Math.max(0, calc.maxVP)) : '—'}
                </p>
                {calc.maxVP > 0 && (
                  <p className={`text-xs font-semibold ${calc.verschil < 0 ? 'text-destructive' : 'text-positive'}`}>
                    {calc.verschil < 0
                      ? `${fmtEUR(Math.abs(calc.verschil))} (${Math.abs(calc.verschilPct).toFixed(1)}%) boven jouw maximum`
                      : `${fmtEUR(calc.verschil)} (${calc.verschilPct.toFixed(1)}%) onder jouw maximum`}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
          <Info className="size-4 shrink-0 mt-0.5" />
          <span>Voer een referentieprijs per m² in om de berekeningen te zien.</span>
        </div>
      )}

      {/* ── Waterfall ─────────────────────────────────────────────────────── */}
      {arv > 0 && (
        <div className="panel p-5 space-y-4">
          <div className={SECTION_HDR}>Winstopbouw (waterval)</div>
          <div className="h-10 flex rounded-lg overflow-hidden border border-border">
            {segments.map((s, i) => (
              <div
                key={i}
                style={{
                  width: `${Math.max(0, (s.value / chartMax) * 100).toFixed(2)}%`,
                  backgroundColor: s.color,
                }}
                className="transition-all duration-300"
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs tabular">
            {segments.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
                <span className="text-muted-foreground">{s.label}:</span>
                <span className="font-semibold">{fmtEUR(s.value)}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-muted-foreground font-medium">= ARV:</span>
              <span className="font-bold text-navy">{fmtEUR(arv)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Recente verkopen in de buurt ──────────────────────────────────── */}
      <div className="panel p-5 space-y-3">
        <div className={SECTION_HDR}>Recente verkopen in de buurt</div>
        <p className="text-sm text-muted-foreground">
          Actuele verkoopprijzen per transactie zijn niet vrij beschikbaar — het Kadaster Koopsommenregister
          vereist een betaald abonnement. Gebruik onderstaande bronnen om de referentieprijs per m² zelf op te zoeken
          en in te voeren in het veld hierboven.
        </p>

        <div className="space-y-2">
          {fundaUrl && (
            <a
              href={fundaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 px-4 py-3 rounded-md border border-border bg-background hover:bg-muted transition-colors"
            >
              <ExternalLink className="size-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  Verkochte woningen op Funda
                  {kad.buurt ? ` — ${kad.buurt}` : kad.gemeente ? ` — ${kad.gemeente}` : ''}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">{fundaUrl}</p>
              </div>
            </a>
          )}
          <a
            href="https://www.woningmarktcijfers.nl"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 px-4 py-3 rounded-md border border-border bg-background hover:bg-muted transition-colors"
          >
            <ExternalLink className="size-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Woningmarktcijfers.nl — gratis marktdata per buurt &amp; gemeente</p>
              <p className="text-[11px] text-muted-foreground">woningmarktcijfers.nl</p>
            </div>
          </a>
          <a
            href="https://www.calcasa.nl/woningwaarde"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 px-4 py-3 rounded-md border border-border bg-background hover:bg-muted transition-colors"
          >
            <ExternalLink className="size-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Calcasa — woningwaarde &amp; vergelijkbare transacties</p>
              <p className="text-[11px] text-muted-foreground">calcasa.nl/woningwaarde</p>
            </div>
          </a>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Noteer de gemiddelde prijs per m² van vergelijkbare woningen in de buurt en vul dit in als referentieprijs per m² hierboven.
        </p>
      </div>
    </div>
  );
}
