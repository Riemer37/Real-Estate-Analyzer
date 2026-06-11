'use client';

import type { PropertyInput, Unit } from '@/lib/calc-types';

const fmt  = (n: number) => '€ ' + Math.round(n).toLocaleString('nl-NL');
const pct  = (n: number) => n.toFixed(2) + '%';
const GEBRUIK_LABEL: Record<string, string> = { verhuurd: 'Verhuurd', leeg: 'Leeg', eigen_gebruik: 'Eigen gebruik' };
const CONTRACT_LABEL: Record<string, string> = { vrije_sector: 'Vrije sector', sociaal: 'Sociale huur', bedrijfsruimte: 'Bedrijfsruimte', onbekend: '—' };

function hwmColor(hwm: number) {
  if (hwm < 15) return 'text-positive';
  if (hwm < 18) return 'text-blue-600 dark:text-blue-400';
  if (hwm < 22) return 'text-warning';
  if (hwm < 25) return 'text-orange-500';
  return 'text-destructive';
}
function barColor(bar: number) {
  if (bar >= 6) return 'text-positive';
  if (bar >= 4.5) return 'text-blue-600 dark:text-blue-400';
  if (bar >= 3) return 'text-warning';
  return 'text-destructive';
}

interface Props { input: PropertyInput }

export default function MultiUnitTab({ input }: Props) {
  const { vraagprijs, units } = input;
  if (!input.isMultiUnit || !units || units.length === 0) {
    return (
      <div className="panel p-10 text-center space-y-2">
        <div className="text-2xl">🏢</div>
        <p className="text-sm font-medium">Geen multi-unit data</p>
        <p className="text-sm text-muted-foreground">Zet "Multi-unit pand" aan in het invoerformulier en voeg de units toe.</p>
      </div>
    );
  }

  const totaalOpp   = units.reduce((s, u) => s + u.oppervlakte, 0);
  const verhuurdeUnits = units.filter(u => u.gebruik === 'verhuurd' && u.maandhuur);
  const totaalJaarhuur = verhuurdeUnits.reduce((s, u) => s + (u.maandhuur ?? 0) * 12, 0);
  const totaalHWM   = totaalJaarhuur > 0 ? vraagprijs / totaalJaarhuur : null;
  const totaalBAR   = totaalJaarhuur > 0 ? (totaalJaarhuur / vraagprijs) * 100 : null;
  const totaalVVE   = units.reduce((s, u) => s + (u.vveKostenPerMaand ?? 0) * 12, 0);
  const totaalNAR   = totaalJaarhuur > 0 ? ((totaalJaarhuur - totaalVVE) / vraagprijs) * 100 : null;

  const totaalLeegwaarde = units.reduce((s, u) => s + (u.leegwaarde ?? 0), 0);
  const uitpondPotentieel = totaalLeegwaarde > 0 ? totaalLeegwaarde - vraagprijs : null;

  const totaalRenovatie = units.reduce((s, u) => s + (u.renovatiekostenPerM2 && u.oppervlakte ? u.renovatiekostenPerM2 * u.oppervlakte : 0), 0);

  // Leegstandsrisico: hoeveel % huur kan wegvallen voor break-even bij 4.5% financieringslasten op 70%?
  const financieringsLast = vraagprijs * 0.70 * 0.045;
  const breakEvenPct = totaalJaarhuur > 0 ? (financieringsLast / totaalJaarhuur) * 100 : null;
  const leegstandsMarge = breakEvenPct ? 100 - breakEvenPct : null;

  // Per unit berekeningen
  type UnitCalc = {
    unit: Unit;
    aandeel: number;
    jaarhuur: number;
    hwm: number | null;
    bar: number | null;
    nar: number | null;
    renovatieKosten: number;
  };

  const unitCalcs: UnitCalc[] = units.map(u => {
    const aandeel   = totaalOpp > 0 ? (u.oppervlakte / totaalOpp) * vraagprijs : 0;
    const jaarhuur  = u.gebruik === 'verhuurd' && u.maandhuur ? u.maandhuur * 12 : 0;
    const hwm       = jaarhuur > 0 && aandeel > 0 ? aandeel / jaarhuur : null;
    const bar       = jaarhuur > 0 && aandeel > 0 ? (jaarhuur / aandeel) * 100 : null;
    const vveJaar   = (u.vveKostenPerMaand ?? 0) * 12;
    const nar       = jaarhuur > 0 && aandeel > 0 ? ((jaarhuur - vveJaar) / aandeel) * 100 : null;
    const renovatieKosten = u.renovatiekostenPerM2 && u.oppervlakte ? u.renovatiekostenPerM2 * u.oppervlakte : 0;
    return { unit: u, aandeel, jaarhuur, hwm, bar, nar, renovatieKosten };
  });

  // 10-jaar uitpond cashflow (1 unit per jaar vrijkomt, verkoop bij leegwaarde)
  const unitsMetLeegwaarde = [...units].filter(u => u.leegwaarde && u.leegwaarde > 0);
  const jaarlijkseHuur = totaalJaarhuur;

  const cashflowJaren: { jaar: number; verkoop: number; huur: number; netto: number; cumulatief: number }[] = [];
  let resterendePand = vraagprijs;
  let cumulatief = -vraagprijs;
  let resterendeJaarhuur = jaarlijkseHuur;
  const verkopenPerJaar = [...unitsMetLeegwaarde];

  for (let jaar = 1; jaar <= 10; jaar++) {
    const verkoop = verkopenPerJaar.length > 0 ? (verkopenPerJaar.shift()?.leegwaarde ?? 0) : 0;
    if (verkoop > 0 && totaalOpp > 0) {
      const verkochteUnit = units.find(u => u.leegwaarde === verkoop);
      const aandeel = verkochteUnit ? (verkochteUnit.oppervlakte / totaalOpp) * vraagprijs : 0;
      resterendePand -= aandeel;
      if (verkochteUnit?.maandhuur) resterendeJaarhuur -= verkochteUnit.maandhuur * 12;
    }
    const nettoJaar = resterendeJaarhuur + verkoop;
    cumulatief += nettoJaar;
    cashflowJaren.push({ jaar, verkoop, huur: resterendeJaarhuur, netto: nettoJaar, cumulatief });
  }

  return (
    <div className="space-y-5">

      {/* Totaaloverzicht */}
      <div className="panel p-5">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-4">Pand totaal — {units.length} units · {totaalOpp} m²</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Totale jaarhuur</div>
            <div className="text-xl font-bold tabular">{totaalJaarhuur > 0 ? fmt(totaalJaarhuur) : '—'}</div>
            <div className="text-[11px] text-muted-foreground">{verhuurdeUnits.length}/{units.length} units verhuurd</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">HWM totaal</div>
            <div className={`text-xl font-bold tabular ${totaalHWM ? hwmColor(totaalHWM) : ''}`}>{totaalHWM ? totaalHWM.toFixed(1) + '×' : '—'}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">BAR / NAR</div>
            <div className={`text-xl font-bold tabular ${totaalBAR ? barColor(totaalBAR) : ''}`}>{totaalBAR ? pct(totaalBAR) : '—'}</div>
            {totaalNAR !== null && <div className="text-xs text-muted-foreground">NAR: {pct(totaalNAR)}</div>}
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Uitpondpotentieel</div>
            <div className={`text-xl font-bold tabular ${uitpondPotentieel !== null && uitpondPotentieel > 0 ? 'text-positive' : 'text-muted-foreground'}`}>
              {uitpondPotentieel !== null ? (uitpondPotentieel > 0 ? '+' : '') + fmt(uitpondPotentieel) : '—'}
            </div>
            {totaalLeegwaarde > 0 && <div className="text-[11px] text-muted-foreground">Totale leegwaarde {fmt(totaalLeegwaarde)}</div>}
          </div>
        </div>
        {leegstandsMarge !== null && (
          <div className="mt-4 pt-3 border-t border-border text-xs text-muted-foreground">
            Leegstandsrisico (bij 70% financiering à 4,5%): <span className="font-semibold text-foreground">{pct(leegstandsMarge)} van de huur mag wegvallen voor break-even</span>
          </div>
        )}
      </div>

      {/* Per-unit tabel */}
      <div className="panel p-5">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-4">Overzicht per unit</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-2 pr-3 font-medium">Unit</th>
                <th className="text-right py-2 px-2 font-medium">m²</th>
                <th className="text-left py-2 px-2 font-medium">Gebruik</th>
                <th className="text-right py-2 px-2 font-medium">Maandhuur</th>
                <th className="text-right py-2 px-2 font-medium">Aandeel</th>
                <th className="text-right py-2 px-2 font-medium">HWM</th>
                <th className="text-right py-2 px-2 font-medium">BAR</th>
                <th className="text-right py-2 px-2 font-medium">Leegwaarde</th>
                <th className="text-left py-2 pl-2 font-medium">Contract</th>
              </tr>
            </thead>
            <tbody>
              {unitCalcs.map(({ unit, aandeel, hwm, bar, renovatieKosten }) => (
                <tr key={unit.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-2 pr-3 font-medium">{unit.omschrijving}</td>
                  <td className="text-right px-2 tabular">{unit.oppervlakte || '—'}</td>
                  <td className="px-2">{GEBRUIK_LABEL[unit.gebruik]}</td>
                  <td className="text-right px-2 tabular">{unit.maandhuur ? fmt(unit.maandhuur) : '—'}</td>
                  <td className="text-right px-2 tabular">{aandeel > 0 ? fmt(aandeel) : '—'}</td>
                  <td className={`text-right px-2 tabular font-semibold ${hwm ? hwmColor(hwm) : ''}`}>{hwm ? hwm.toFixed(1) + '×' : '—'}</td>
                  <td className={`text-right px-2 tabular font-semibold ${bar ? barColor(bar) : ''}`}>{bar ? pct(bar) : '—'}</td>
                  <td className="text-right px-2 tabular">{unit.leegwaarde ? fmt(unit.leegwaarde) : '—'}</td>
                  <td className="pl-2 text-muted-foreground">{CONTRACT_LABEL[unit.huurcontractType]}</td>
                </tr>
              ))}
            </tbody>
            {totaalRenovatie > 0 && (
              <tfoot>
                <tr className="border-t border-border text-muted-foreground">
                  <td colSpan={9} className="pt-2 text-xs">Totale renovatiekosten: <span className="font-semibold text-foreground">{fmt(totaalRenovatie)}</span></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Strategieën vergelijking */}
      <div className="panel p-5">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-4">Strategieën vergelijking</div>
        <div className="space-y-2">
          {[
            {
              nr: 1,
              naam: 'Heel pand verhuren als belegging',
              waarde: totaalBAR !== null ? `BAR ${pct(totaalBAR)}` : '—',
              toelichting: totaalHWM !== null ? `HWM ${totaalHWM.toFixed(1)}× — ${totaalHWM < 15 ? 'uitstekend rendement' : totaalHWM < 18 ? 'marktconform' : totaalHWM < 22 ? 'rendement onder druk' : 'te duur als puur beleggingspand'}` : 'Vul maandhuur per unit in',
              highlight: totaalHWM !== null && totaalHWM < 18,
            },
            {
              nr: 2,
              naam: 'Per unit uitponden bij vrijkomen huurder',
              waarde: uitpondPotentieel !== null ? (uitpondPotentieel > 0 ? '+' : '') + fmt(uitpondPotentieel) : '—',
              toelichting: totaalLeegwaarde > 0 ? `Totale leegwaarde ${fmt(totaalLeegwaarde)} bij vraagprijs ${fmt(vraagprijs)}` : 'Vul leegwaarde per unit in',
              highlight: uitpondPotentieel !== null && uitpondPotentieel > 0,
            },
            {
              nr: 3,
              naam: 'Heel pand leegmaken en gesplitst verkopen',
              waarde: totaalLeegwaarde > 0 ? fmt(totaalLeegwaarde) : '—',
              toelichting: totaalLeegwaarde > 0 ? `Brutopotentieel ${fmt(totaalLeegwaarde)} (excl. verkoopkosten ~2%)` : 'Vul leegwaarde per unit in voor berekening',
              highlight: false,
            },
            {
              nr: 4,
              naam: 'Mix: deel verhuren, deel verkopen',
              waarde: '—',
              toelichting: 'Combineer verhuurde units voor cashflow en lege units voor directe verkoopopbrengst',
              highlight: false,
            },
            {
              nr: 5,
              naam: 'Renoveren voor hogere huur of verkoopprijs',
              waarde: totaalRenovatie > 0 ? fmt(totaalRenovatie) : 'Geen renov. ingevoerd',
              toelichting: totaalRenovatie > 0 ? `Investeringsbehoefte ${fmt(totaalRenovatie)} totaal` : 'Voeg renovatiekosten per unit in voor berekening',
              highlight: false,
            },
            {
              nr: 6,
              naam: 'Extra units toevoegen (optoppen/dakopbouw)',
              waarde: '—',
              toelichting: 'Afhankelijk van bestemmingsplan en constructie — zie AI Analyse voor haalbaarheid',
              highlight: false,
            },
          ].map(s => (
            <div key={s.nr} className={`flex items-start gap-3 rounded-lg p-3 border ${s.highlight ? 'border-positive/30 bg-positive/5' : 'border-border bg-muted/20'}`}>
              <span className="text-[11px] font-bold text-muted-foreground mt-0.5 w-4 shrink-0">{s.nr}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{s.naam}</span>
                  <span className={`text-sm font-bold tabular shrink-0 ${s.highlight ? 'text-positive' : ''}`}>{s.waarde}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{s.toelichting}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Uitpond detail */}
      {totaalLeegwaarde > 0 && (
        <div className="panel p-5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-4">Uitpond analyse</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Totale uitpondwaarde</div>
              <div className="text-xl font-bold tabular">{fmt(totaalLeegwaarde)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Aankoopprijs</div>
              <div className="text-xl font-bold tabular">{fmt(vraagprijs)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Bruto uitpondwinst</div>
              <div className={`text-xl font-bold tabular ${uitpondPotentieel && uitpondPotentieel > 0 ? 'text-positive' : 'text-destructive'}`}>
                {uitpondPotentieel !== null ? (uitpondPotentieel > 0 ? '+' : '') + fmt(uitpondPotentieel) : '—'}
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            {unitCalcs.map(({ unit }) => unit.leegwaarde ? (
              <div key={unit.id} className="flex items-center justify-between text-sm border-b border-border/40 pb-1">
                <span className="text-muted-foreground">{unit.omschrijving}</span>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground">{unit.gebruik === 'verhuurd' ? '📋 verhuurd' : '🔓 leeg'}</span>
                  <span className="font-semibold tabular">{fmt(unit.leegwaarde)}</span>
                </div>
              </div>
            ) : null)}
          </div>
        </div>
      )}

      {/* 10-jaar cashflow */}
      {jaarlijkseHuur > 0 && (
        <div className="panel p-5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">10-jaar cashflow (uitpondscenario)</div>
          <p className="text-[11px] text-muted-foreground mb-4">Aanname: 1 unit per jaar vrijkomt en verkocht wordt. Exclusief financieringslasten en belasting.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-1.5 pr-3 font-medium">Jaar</th>
                  <th className="text-right py-1.5 px-2 font-medium">Verkoopopbrengst</th>
                  <th className="text-right py-1.5 px-2 font-medium">Huurinkomsten</th>
                  <th className="text-right py-1.5 px-2 font-medium">Totaal jaar</th>
                  <th className="text-right py-1.5 pl-2 font-medium">Cumulatief</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50 text-muted-foreground italic">
                  <td className="py-1.5 pr-3">0 (aankoop)</td>
                  <td className="text-right px-2">—</td>
                  <td className="text-right px-2">—</td>
                  <td className="text-right px-2 text-destructive font-semibold">−{fmt(vraagprijs)}</td>
                  <td className="text-right pl-2 text-destructive font-semibold">−{fmt(vraagprijs)}</td>
                </tr>
                {cashflowJaren.map(r => (
                  <tr key={r.jaar} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-1.5 pr-3 font-medium">Jaar {r.jaar}</td>
                    <td className="text-right px-2 tabular">{r.verkoop > 0 ? fmt(r.verkoop) : '—'}</td>
                    <td className="text-right px-2 tabular">{r.huur > 0 ? fmt(r.huur) : '—'}</td>
                    <td className="text-right px-2 tabular font-semibold">{fmt(r.netto)}</td>
                    <td className={`text-right pl-2 tabular font-semibold ${r.cumulatief >= 0 ? 'text-positive' : 'text-destructive'}`}>
                      {r.cumulatief >= 0 ? '+' : ''}{fmt(r.cumulatief)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Risico's */}
      <div className="panel p-5">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3">Risico's & aandachtspunten</div>
        <ul className="space-y-2">
          {[
            units.some(u => u.huurcontractType === 'sociaal') && '⚠ Sociale huurders: sterke huurbescherming — uitponden duurt langer en is lastiger',
            units.filter(u => u.gebruik === 'leeg').length > 0 && `⚠ ${units.filter(u => u.gebruik === 'leeg').length} lege unit(s) — direct leegstandrisico en geen huurinkomsten`,
            leegstandsMarge !== null && leegstandsMarge < 30 && `⚠ Leegstandsmarge is slechts ${leegstandsMarge.toFixed(0)}% — cashflow snel negatief bij leegstand`,
            '⚠ Controleer in Kadaster of pand al gesplitst is — zo niet: splitsing vereist vergunning, VvE-oprichting en notariskosten (ca. €5.000–€15.000)',
            units.some(u => (u.vveKostenPerMaand ?? 0) === 0) && '⚠ Geen VvE-bijdrage ingevuld — controleer of er een reservefonds aanwezig is',
            totaalRenovatie > 0 && `⚠ Totale renovatiebehoefte ${fmt(totaalRenovatie)} — financier dit mee in bod of stel lager bod`,
          ].filter(Boolean).map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="text-warning font-bold shrink-0">⚠</span>
              <span className="text-foreground/90">{(r as string).replace('⚠ ', '')}</span>
            </li>
          ))}
          {[
            units.some(u => u.huurcontractType === 'sociaal'),
            units.some(u => u.gebruik === 'leeg'),
            leegstandsMarge !== null && leegstandsMarge < 30,
            true,
            units.some(u => (u.vveKostenPerMaand ?? 0) === 0),
            totaalRenovatie > 0,
          ].every(v => !v) && (
            <li className="text-sm text-muted-foreground">Geen specifieke risicovlaggen gedetecteerd op basis van ingevoerde data.</li>
          )}
        </ul>
      </div>

    </div>
  );
}
