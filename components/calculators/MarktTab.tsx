'use client';

import type { PropertyInput, KadasterInfo } from '@/lib/calc-types';
import { fmtEUR } from '@/lib/calculations';

function fmt(n: number) { return fmtEUR(n); }
function fmtPct(n: number) { return n.toFixed(1) + '%'; }

type BronType = 'officieel' | 'berekend' | 'invoer';
const BRON_CLS: Record<BronType, string> = {
  officieel: 'bg-positive/10 text-positive border-positive/25',
  berekend:  'bg-warning/10 text-warning border-warning/25',
  invoer:    'bg-muted text-muted-foreground border-border',
};
function BronBadge({ type, label }: { type: BronType; label: string }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wide ${BRON_CLS[type]}`}>
      {label}
    </span>
  );
}

function StatCard({
  label, value, sub, color, bron, bronType,
}: {
  label: string; value: string; sub?: string; color?: string; bron?: string; bronType?: BronType;
}) {
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between gap-1 mb-1">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</div>
        {bron && bronType && <BronBadge type={bronType} label={bron} />}
      </div>
      <div className={`text-xl font-extrabold tabular ${color ?? 'text-navy'}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function fmtDatum(d: string): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
}

function DataRow({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div className={`flex justify-between items-baseline text-sm py-1.5 border-b border-border last:border-0 ${highlight ? 'font-semibold' : ''}`}>
      <span className="text-muted-foreground">{k}</span>
      <span className="tabular font-medium">{v}</span>
    </div>
  );
}

// Simple SVG bar chart for WOZ history
function WozChart({ history }: { history: { jaar: number; waarde: number }[] }) {
  if (history.length < 2) return null;
  const sorted = [...history].sort((a, b) => a.jaar - b.jaar);
  const max = Math.max(...sorted.map(w => w.waarde));
  const min = Math.min(...sorted.map(w => w.waarde)) * 0.9;
  const W = 500; const H = 120; const PAD = 40;

  const toX = (i: number) => PAD + ((W - PAD * 2) * i) / (sorted.length - 1);
  const toY = (v: number) => H - PAD - ((v - min) / (max - min)) * (H - PAD * 1.5);

  const path = sorted.map((w, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(w.waarde).toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-28">
      {sorted.map((w, i) => {
        const x = toX(i); const y = toY(w.waarde);
        return (
          <g key={w.jaar}>
            <line x1={x} y1={PAD} x2={x} y2={H - PAD} stroke="currentColor" strokeOpacity={0.06} strokeWidth={1} />
            <text x={x} y={H - 6} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.45}>{w.jaar}</text>
            <text x={x} y={y - 6} textAnchor="middle" fontSize={8} fill="currentColor" opacity={0.5}>
              {w.waarde >= 1000000 ? (w.waarde / 1000000).toFixed(1) + 'M' : Math.round(w.waarde / 1000) + 'k'}
            </text>
          </g>
        );
      })}
      <path d={path} fill="none" stroke="#1e3a5f" strokeWidth={2} strokeLinejoin="round" />
      {sorted.map((w, i) => (
        <circle key={w.jaar} cx={toX(i)} cy={toY(w.waarde)} r={3} fill="#1e3a5f" />
      ))}
    </svg>
  );
}

export default function MarktTab({ input, kad }: { input: PropertyInput; kad: KadasterInfo }) {
  const heeftCBS          = kad.cbsGemWoningWaarde != null;
  const heeftKoopsom      = kad.gemKoopsomBuurt != null;
  const heeftWoz          = kad.wozHistory.length > 0;
  const heeftRP           = !!kad.rpNaam;
  const heeftTransacties  = (kad.koopsommen?.length ?? 0) > 0;
  const transacties       = [...(kad.koopsommen ?? [])].sort((a, b) => b.datum.localeCompare(a.datum));

  // Prijs per m2 vergelijkingen
  const vraagprijsPerM2 = input.woonoppervlakte > 0 ? input.vraagprijs / input.woonoppervlakte : 0;
  const wozPerM2        = kad.officielSqm && kad.wozHuidig ? kad.wozHuidig / kad.officielSqm : null;
  const cbsPerM2        = kad.cbsGemWoningWaarde ?? null;
  const koopsomPerM2    = kad.gemKoopsomBuurt ?? null;

  // WOZ CAGR
  const sorted = [...kad.wozHistory].sort((a, b) => a.jaar - b.jaar);
  const cagr = sorted.length >= 2 && sorted[0].waarde > 0
    ? ((Math.pow(sorted[sorted.length - 1].waarde / sorted[0].waarde,
        1 / (sorted[sorted.length - 1].jaar - sorted[0].jaar)) - 1) * 100)
    : null;

  // Vraagprijs vs WOZ
  const wozVerhouding = kad.wozHuidig && kad.wozHuidig > 0
    ? ((input.vraagprijs / kad.wozHuidig - 1) * 100) : null;

  // Vraagprijs vs buurtgemiddelde
  const buurtVerhouding = kad.gemKoopsomBuurt
    ? ((input.vraagprijs / kad.gemKoopsomBuurt - 1) * 100) : null;

  const geenData = !heeftCBS && !heeftKoopsom && !heeftWoz && !heeftRP;

  if (geenData) {
    return (
      <div className="panel p-8 text-center space-y-3">
        <div className="text-2xl">📡</div>
        <p className="text-sm text-muted-foreground">
          Geen buurtdata beschikbaar. Zorg dat het adres correct is ingevoerd zodat CBS, Kadaster en RuimtelijkePlannen data kunnen worden opgehaald.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Prijsvergelijking ── */}
      <div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3">Prijsvergelijking</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Vraagprijs/m²"
            value={vraagprijsPerM2 > 0 ? `€ ${Math.round(vraagprijsPerM2).toLocaleString('nl-NL')}` : '—'}
            sub={`${input.woonoppervlakte} m²`}
            bron="Invoer"
            bronType="invoer"
          />
          {wozPerM2 && (
            <StatCard
              label="WOZ/m² (officieel)"
              value={`€ ${Math.round(wozPerM2).toLocaleString('nl-NL')}`}
              sub={kad.officielSqm ? `${kad.officielSqm} m² officieel` : undefined}
              bron="BAG/WOZ"
              bronType="officieel"
            />
          )}
          {cbsPerM2 && (
            <StatCard
              label="Gem. woningwaarde buurt"
              value={fmt(cbsPerM2)}
              bron="CBS"
              bronType="officieel"
              color={input.vraagprijs > cbsPerM2 ? 'text-warning' : 'text-positive'}
            />
          )}
          {koopsomPerM2 && (
            <StatCard
              label="Gem. koopsom buurt"
              value={fmt(koopsomPerM2)}
              sub={kad.koopsomAantal ? `${kad.koopsomAantal} transacties` : undefined}
              bron="Kadaster"
              bronType="officieel"
              color={input.vraagprijs > koopsomPerM2 ? 'text-warning' : 'text-positive'}
            />
          )}
        </div>
      </div>

      {/* ── Vraagprijs context ── */}
      {(wozVerhouding !== null || buurtVerhouding !== null) && (
        <div className="panel p-5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-4">Vraagprijs in context</div>
          <div className="space-y-4">
            {wozVerhouding !== null && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Vraagprijs vs WOZ-waarde</span>
                  <span className={`font-bold tabular ${Math.abs(wozVerhouding) > 30 ? 'text-destructive' : wozVerhouding > 10 ? 'text-warning' : 'text-positive'}`}>
                    {wozVerhouding > 0 ? '+' : ''}{wozVerhouding.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${Math.abs(wozVerhouding) > 30 ? 'bg-destructive' : wozVerhouding > 10 ? 'bg-warning' : 'bg-positive'}`}
                    style={{ width: `${Math.min(100, Math.abs(wozVerhouding) * 2)}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {wozVerhouding > 20
                    ? 'Vraagprijs ligt significant boven WOZ — gebruikelijk bij populaire locaties maar check marktdata.'
                    : wozVerhouding < -10
                    ? 'Vraagprijs onder WOZ — mogelijke koopkans, controleer de staat van het pand.'
                    : 'Vraagprijs ligt binnen normale bandbreedte t.o.v. WOZ.'}
                </p>
              </div>
            )}
            {buurtVerhouding !== null && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Vraagprijs vs buurtgemiddelde koopsom</span>
                  <span className={`font-bold tabular ${buurtVerhouding > 20 ? 'text-destructive' : buurtVerhouding > 0 ? 'text-warning' : 'text-positive'}`}>
                    {buurtVerhouding > 0 ? '+' : ''}{buurtVerhouding.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${buurtVerhouding > 20 ? 'bg-destructive' : buurtVerhouding > 0 ? 'bg-warning' : 'bg-positive'}`}
                    style={{ width: `${Math.min(100, Math.abs(buurtVerhouding) * 2)}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {buurtVerhouding > 20
                    ? `Vraagprijs ligt ${buurtVerhouding.toFixed(0)}% boven het buurtgemiddelde van ${fmt(kad.gemKoopsomBuurt!)} — onderhandelen loont.`
                    : buurtVerhouding < -10
                    ? `Onder het buurtgemiddelde van ${fmt(kad.gemKoopsomBuurt!)} — mogelijk aantrekkelijke prijs.`
                    : `In lijn met het buurtgemiddelde van ${fmt(kad.gemKoopsomBuurt!)}.`}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CBS Buurtstatistieken ── */}
      {heeftCBS && (
        <div className="panel p-5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3">
            CBS Buurtstatistieken — {kad.buurt ?? 'buurt'}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {kad.cbsGemWoningWaarde && (
              <div className="text-center">
                <div className="text-lg font-extrabold tabular text-navy">{fmt(kad.cbsGemWoningWaarde)}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Gem. woningwaarde</div>
              </div>
            )}
            {kad.cbsGemInkomen && (
              <div className="text-center">
                <div className="text-lg font-extrabold tabular text-navy">{fmt(kad.cbsGemInkomen)}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Gem. inkomen/jaar</div>
              </div>
            )}
            {kad.cbsPctKoop != null && (
              <div className="text-center">
                <div className="text-lg font-extrabold tabular text-positive">{fmtPct(kad.cbsPctKoop)}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Koopwoningen</div>
              </div>
            )}
            {kad.cbsPctHuur != null && (
              <div className="text-center">
                <div className="text-lg font-extrabold tabular text-warning">{fmtPct(kad.cbsPctHuur)}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Huurwoningen</div>
              </div>
            )}
            {kad.cbsLeegstand != null && (
              <div className="text-center">
                <div className="text-lg font-extrabold tabular text-muted-foreground">{fmtPct(kad.cbsLeegstand)}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Leegstand</div>
              </div>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground/50 mt-3">Bron: CBS Wijken & Buurten 2024</p>
        </div>
      )}

      {/* ── WOZ historisch ── */}
      {heeftWoz && (
        <div className="panel p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
              WOZ-waardeontwikkeling
            </div>
            {cagr !== null && (
              <span className={`text-xs font-bold tabular ${cagr >= 3 ? 'text-positive' : cagr >= 0 ? 'text-warning' : 'text-destructive'}`}>
                gem. {cagr.toFixed(1)}%/jaar
              </span>
            )}
          </div>
          <WozChart history={kad.wozHistory} />
          <div className="mt-3 grid grid-cols-3 sm:grid-cols-5 gap-2">
            {sorted.slice(-5).reverse().map(w => (
              <div key={w.jaar} className="text-center">
                <div className="text-sm font-semibold tabular">{fmt(w.waarde)}</div>
                <div className="text-[10px] text-muted-foreground">{w.jaar}</div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground/50 mt-2">Bron: WOZ-registers via BAG</p>
        </div>
      )}

      {/* ── Bestemmingsplan ── */}
      {heeftRP && (
        <div className="panel p-5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3">Bestemmingsplan</div>
          <div className="space-y-0">
            <DataRow k="Plan" v={kad.rpNaam ?? '—'} />
            <DataRow k="Bestemming" v={kad.rpBestemming ?? '—'} highlight />
            <DataRow k="Hoofdgroep" v={kad.rpHoofdgroep ?? '—'} />
            <DataRow k="Plandatum" v={kad.rpPlanDatum ?? '—'} />
          </div>
          {kad.rpBestemming?.toLowerCase().includes('gemengd') && (
            <div className="mt-3 p-3 rounded-md bg-positive/5 border border-positive/20 text-xs text-foreground/80 leading-relaxed">
              <strong>Gemengde bestemming</strong> — doorgaans toegestaan: wonen, kantoor, detailhandel, horeca (lichte vormen), zorg en maatschappelijke functies. De exacte artikelen staan in de planregels.
            </div>
          )}
          {kad.rpBestemming?.toLowerCase().includes('wonen') && !kad.rpBestemming?.toLowerCase().includes('gemengd') && (
            <div className="mt-3 p-3 rounded-md bg-muted border border-border text-xs text-foreground/80 leading-relaxed">
              <strong>Woonbestemming</strong> — primair bestemd voor woondoeleinden. Kantoor aan huis (max ~30%) en zorgfuncties zijn vaak mogelijk via afwijkingsbepaling.
            </div>
          )}
          {kad.rpViewerUrl && (
            <a href={kad.rpViewerUrl} target="_blank" rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-navy hover:underline">
              Volledige planregels bekijken op ruimtelijkeplannen.nl ↗
            </a>
          )}
        </div>
      )}

      {/* ── Locatiegegevens ── */}
      <div className="panel p-5">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3">Locatie</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          {[
            { k: 'Gemeente', v: kad.gemeente ?? '—' },
            { k: 'Buurt', v: kad.buurt ?? '—' },
            { k: 'Woonplaats', v: kad.woonplaats ?? '—' },
            { k: 'BAG-id', v: kad.bagId ?? '—' },
          ].map(({ k, v }) => (
            <div key={k}>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{k}</div>
              <div className="font-medium truncate">{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Recente transacties ── */}
      {heeftTransacties && (
        <div className="panel p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
              Recente transacties in de buurt
            </div>
            <BronBadge type="officieel" label="Kadaster" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1.5 pr-4 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Datum</th>
                  <th className="text-right py-1.5 pr-4 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Koopsom</th>
                  <th className="text-right py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Afstand</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transacties.map((t, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2 pr-4 text-muted-foreground">{fmtDatum(t.datum)}</td>
                    <td className="py-2 pr-4 text-right font-semibold tabular">{fmt(t.prijs)}</td>
                    <td className="py-2 text-right text-muted-foreground tabular">
                      {t.afstand !== null ? `~${t.afstand}m` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-muted-foreground/60 mt-3">
            Werkelijk betaalde koopsommen (officieel Kadaster-register, max 3 jaar terug, binnen ~300m). Geen adressen of woonoppervlakte beschikbaar.
          </p>
        </div>
      )}

      {/* ── Pand- & locatieinfo ── */}
      {(kad.bouwjaar || kad.officielSqm) && (
        <div className="panel p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Pandgegevens</div>
            <BronBadge type="officieel" label="BAG" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            {kad.bouwjaar && (
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Bouwjaar</div>
                <div className="font-semibold">{kad.bouwjaar}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date().getFullYear() - kad.bouwjaar} jaar oud
                </div>
              </div>
            )}
            {kad.officielSqm && (
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Officieel opp. (BAG)</div>
                <div className="font-semibold">{kad.officielSqm} m²</div>
                {kad.officielSqm !== input.woonoppervlakte && (
                  <div className="text-[10px] text-warning mt-0.5">
                    Invoer: {input.woonoppervlakte} m²
                  </div>
                )}
              </div>
            )}
            {kad.perceelOppervlakte && (
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Perceeloppervlak</div>
                <div className="font-semibold">{kad.perceelOppervlakte} m²</div>
              </div>
            )}
            {kad.gebruiksdoel && (
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Gebruiksdoel (BAG)</div>
                <div className="font-semibold">{kad.gebruiksdoel}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Data beschikbaarheid ── */}
      <div className="panel p-4">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Beschikbare databronnen</div>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'BAG/Kadaster', ok: kad.found },
            { label: 'WOZ-historie', ok: heeftWoz },
            { label: 'CBS buurt', ok: heeftCBS },
            { label: 'Kadaster koopsommen', ok: heeftKoopsom },
            { label: `Recente transacties (${kad.koopsomAantal ?? 0})`, ok: heeftTransacties },
            { label: 'RuimtelijkePlannen', ok: heeftRP },
            { label: 'EP-Online energielabel', ok: !!kad.energielabelEP },
            { label: 'Bouwjaar (BAG)', ok: !!kad.bouwjaar },
          ].map(({ label, ok }) => (
            <span key={label} className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${
              ok ? 'bg-positive/10 border-positive/30 text-positive' : 'bg-muted border-border text-muted-foreground/50'
            }`}>
              {ok ? '✓' : '✗'} {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
