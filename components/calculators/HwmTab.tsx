'use client';

import type { PropertyInput } from '@/lib/calc-types';

const fmtEUR  = (n: number) => '€ ' + Math.round(n).toLocaleString('nl-NL');
const fmtPct  = (n: number) => n.toFixed(2) + '%';
const diffStr = (a: number, b: number) =>
  a < b ? fmtEUR(b - a) + ' onder vraagprijs' : a > b ? fmtEUR(a - b) + ' boven vraagprijs' : 'gelijk aan vraagprijs';

const HWM_LEVELS = [
  { max: 15,  label: '< 15×',   omschrijving: 'Zeer goedkoop',  color: 'text-positive',                         bg: 'bg-positive/10 border-positive/20' },
  { max: 18,  label: '15–18×',  omschrijving: 'Goed',           color: 'text-blue-600 dark:text-blue-400',      bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800' },
  { max: 22,  label: '18–22×',  omschrijving: 'Gemiddeld',      color: 'text-warning',                          bg: 'bg-warning/10 border-warning/20' },
  { max: 25,  label: '22–25×',  omschrijving: 'Duur',           color: 'text-orange-500',                       bg: 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800' },
  { max: Infinity, label: '> 25×', omschrijving: 'Te duur',     color: 'text-destructive',                      bg: 'bg-destructive/8 border-destructive/20' },
];

function hwmInfo(hwm: number) {
  return HWM_LEVELS.find(l => hwm < l.max) ?? HWM_LEVELS[HWM_LEVELS.length - 1];
}

interface HwmTabProps {
  input: PropertyInput;
}

export default function HwmTab({ input }: HwmTabProps) {
  const { vraagprijs, huidigeHuurprijs, verwachteHuurprijs, vasteLastenPerMaand, huurcontractType } = input;

  if (!huidigeHuurprijs || huidigeHuurprijs <= 0) {
    return (
      <div className="panel p-10 text-center space-y-2">
        <div className="text-2xl">🏠</div>
        <p className="text-sm font-medium text-foreground">Geen huurdata ingevuld</p>
        <p className="text-sm text-muted-foreground">Vul een huidige maandhuur in bij "Verhuurd pand" om de HWM-analyse te zien.</p>
      </div>
    );
  }

  const jaarhuur     = huidigeHuurprijs * 12;
  const hwm          = vraagprijs / jaarhuur;
  const info         = hwmInfo(hwm);
  const bar          = (jaarhuur / vraagprijs) * 100;
  const vasteJaar    = (vasteLastenPerMaand ?? 0) * 12;
  const nar          = vasteJaar > 0 ? ((jaarhuur - vasteJaar) / vraagprijs) * 100 : null;
  const maxBod15     = jaarhuur * 15;
  const maxBod18     = jaarhuur * 18;

  const markthuur    = verwachteHuurprijs && verwachteHuurprijs > 0 ? verwachteHuurprijs : null;
  const markthuurJaar = markthuur ? markthuur * 12 : null;
  const hwmMarkt     = markthuurJaar ? vraagprijs / markthuurJaar : null;
  const barMarkt     = markthuurJaar ? (markthuurJaar / vraagprijs) * 100 : null;
  const huurPotentieel = markthuur ? (markthuur - huidigeHuurprijs) * 12 : null;

  return (
    <div className="space-y-5">

      {/* HWM hoofdkaart */}
      <div className="panel p-5">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-4">Huurwaardemultiplicator (HWM)</div>
        <div className="flex items-baseline gap-3 mb-5">
          <span className={`text-5xl font-extrabold tabular ${info.color}`}>{hwm.toFixed(1)}×</span>
          <span className={`text-sm font-semibold ${info.color}`}>{info.omschrijving}</span>
        </div>

        {/* Schaal */}
        <div className="grid grid-cols-5 gap-1 text-[10px] text-center">
          {HWM_LEVELS.map(l => {
            const active = info.label === l.label;
            return (
              <div key={l.label} className={`rounded px-1 py-1.5 border ${active ? l.bg + ' font-bold ring-1 ring-current/20' : 'bg-muted/40 border-border text-muted-foreground/50'}`}>
                <div className={active ? l.color : ''}>{l.label}</div>
                <div className="font-normal mt-0.5">{l.omschrijving}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rendementen */}
      <div className="panel p-5">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-4">Rendementen op basis van huidige huur</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Maandhuur</div>
            <div className="text-xl font-bold tabular">{fmtEUR(huidigeHuurprijs)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Jaarhuur</div>
            <div className="text-xl font-bold tabular">{fmtEUR(jaarhuur)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">BAR (bruto)</div>
            <div className={`text-xl font-bold tabular ${bar >= 5 ? 'text-positive' : bar >= 4 ? 'text-warning' : 'text-destructive'}`}>{fmtPct(bar)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">NAR (netto)</div>
            {nar !== null
              ? <div className={`text-xl font-bold tabular ${nar >= 4 ? 'text-positive' : nar >= 3 ? 'text-warning' : 'text-destructive'}`}>{fmtPct(nar)}</div>
              : <div className="text-sm text-muted-foreground mt-1">Vul vaste lasten in</div>
            }
          </div>
        </div>
        {huurcontractType !== 'onbekend' && (
          <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
            Huurcontract: <span className="font-semibold text-foreground">{huurcontractType === 'vrije_sector' ? 'Vrije sector — huurder makkelijker te bewegen' : 'Sociale huur — sterke huurbescherming, lagere exitflexibiliteit'}</span>
          </div>
        )}
      </div>

      {/* Max biedprijs */}
      <div className="panel p-5">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-4">Maximale biedprijs op basis van huur</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`rounded-xl border-2 p-5 bg-positive/5 border-positive/30`}>
            <div className="text-xs text-muted-foreground mb-1">Bij HWM 15× — <span className="text-positive font-semibold">sterk rendement</span></div>
            <div className="text-3xl font-extrabold tabular text-positive mb-1">{fmtEUR(maxBod15)}</div>
            <div className={`text-xs font-medium ${maxBod15 < vraagprijs ? 'text-destructive' : 'text-positive'}`}>{diffStr(maxBod15, vraagprijs)}</div>
          </div>
          <div className="rounded-xl border-2 p-5 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
            <div className="text-xs text-muted-foreground mb-1">Bij HWM 18× — <span className="text-blue-600 dark:text-blue-400 font-semibold">marktconform</span></div>
            <div className="text-3xl font-extrabold tabular text-blue-600 dark:text-blue-400 mb-1">{fmtEUR(maxBod18)}</div>
            <div className={`text-xs font-medium ${maxBod18 < vraagprijs ? 'text-destructive' : 'text-positive'}`}>{diffStr(maxBod18, vraagprijs)}</div>
          </div>
        </div>
      </div>

      {/* Markthuurvergelijking */}
      {markthuur && hwmMarkt && barMarkt && huurPotentieel !== null && (
        <div className="panel p-5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-4">
            Markthuurpotentieel — verwachte huurprijs {fmtEUR(markthuur)}/maand
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">HWM bij markthuur</div>
              <div className={`text-xl font-bold tabular ${hwmInfo(hwmMarkt).color}`}>{hwmMarkt.toFixed(1)}× <span className="text-xs font-normal text-muted-foreground">({hwmInfo(hwmMarkt).omschrijving})</span></div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">BAR bij markthuur</div>
              <div className={`text-xl font-bold tabular ${barMarkt >= 5 ? 'text-positive' : 'text-warning'}`}>{fmtPct(barMarkt)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Huurpotentieel</div>
              <div className={`text-xl font-bold tabular ${huurPotentieel > 0 ? 'text-positive' : 'text-muted-foreground'}`}>
                {huurPotentieel > 0 ? '+' : ''}{fmtEUR(huurPotentieel)}/jaar
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {markthuur > huidigeHuurprijs ? 'Huurder betaalt onder markthuur' : markthuur < huidigeHuurprijs ? 'Huurder betaalt boven markthuur' : 'Op marktniveau'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Advies */}
      <div className="panel p-5 space-y-2">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3">Advies verhuurd pand</div>
        <div className={`rounded-lg border p-4 ${info.bg}`}>
          <p className={`text-sm font-semibold ${info.color} mb-1`}>
            HWM {hwm.toFixed(1)}× — {
              hwm < 15 ? 'Sterk instapmoment. Rendement ligt direct boven marktnorm.'
              : hwm < 18 ? 'Marktconform. Solide beleggingspand bij huidig huurniveau.'
              : hwm < 22 ? 'Rendement staat onder druk. Huurpotentieel of waardestijging nodig om te rechtvaardigen.'
              : hwm < 25 ? 'Duur. Alleen interessant bij concreet herontwikkelingspotentieel of huurverhoging.'
              : 'Te duur als puur beleggingspand. Analyseer alternatieve strategieën (flip, splitsen).'
            }
          </p>
          <p className="text-xs text-muted-foreground">
            Max bod bij HWM 15×: <span className="font-semibold">{fmtEUR(maxBod15)}</span> &nbsp;·&nbsp;
            Max bod bij HWM 18×: <span className="font-semibold">{fmtEUR(maxBod18)}</span>
          </p>
        </div>
      </div>

    </div>
  );
}
