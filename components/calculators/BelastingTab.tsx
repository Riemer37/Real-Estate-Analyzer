'use client';

import { useState, useMemo } from 'react';
import type { PropertyInput, KadasterInfo } from '@/lib/calc-types';
import { fmtEUR, fmtPct } from '@/lib/calculations';

const INPUT_CLS = 'w-full bg-background border border-border rounded-md px-3 py-2 tabular text-sm';
const SECTION_HDR = 'text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3';

const GROTE_STEDEN = ['Amsterdam', 'Utrecht', 'Den Haag', 'Rotterdam', 'Eindhoven', 'Haarlem'];

function Line({ k, v, bold, color }: { k: string; v: string; bold?: boolean; color?: string }) {
  return (
    <div className={`flex justify-between items-baseline text-sm ${bold ? 'font-bold' : ''}`}>
      <span className="text-muted-foreground">{k}</span>
      <span className={`tabular ${color ?? ''}`}>{v}</span>
    </div>
  );
}

function RiskBar({ label, score }: { label: string; score: number }) {
  const color = score <= 3
    ? 'bg-positive'
    : score <= 6
      ? 'bg-warning'
      : 'bg-destructive';

  const textColor = score <= 3
    ? 'text-positive'
    : score <= 6
      ? 'text-warning'
      : 'text-destructive';

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={`text-sm font-bold tabular ${textColor}`}>{score}/10</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${score * 10}%` }}
        />
      </div>
    </div>
  );
}

interface BelastingTabProps {
  input: PropertyInput;
  kad: KadasterInfo;
}

export default function BelastingTab({ input, kad }: BelastingTabProps) {
  // Box 3 state
  const [wozOverride, setWozOverride] = useState(input.wozWaarde);
  const [hypotheek, setHypotheek] = useState(0);
  const [partners, setPartners] = useState(false);

  const box3 = useMemo(() => {
    const heffingsvrij = partners ? 114000 : 57000;
    const belastbaarVermogen = Math.max(0, wozOverride - hypotheek - heffingsvrij);
    const fictiefRendement = belastbaarVermogen * 0.0588;
    const belasting = Math.round(fictiefRendement * 0.36);
    const maandlast = Math.round(belasting / 12);
    return { heffingsvrij, belastbaarVermogen, fictiefRendement, belasting, maandlast };
  }, [wozOverride, hypotheek, partners]);

  // Risicoscore
  const risico = useMemo(() => {
    // Locatie
    let locatie = 5;
    if (GROTE_STEDEN.includes(kad.gemeente ?? '')) locatie -= 1;
    if (input.erfpacht) locatie += 1;
    locatie = Math.min(10, Math.max(1, locatie));

    // Staat
    const staatMap: Record<string, number> = {
      uitstekend: 1, goed: 3, redelijk: 5, slecht: 7, te_renoveren: 9,
    };
    let staat = staatMap[input.conditie] ?? 5;
    if (['F', 'G', 'Onbekend'].includes(input.energielabel)) staat += 1;
    staat = Math.min(10, Math.max(1, staat));

    // Markt
    const wozRatio = input.wozWaarde > 0 ? input.vraagprijs / input.wozWaarde : 1;
    let markt: number;
    if (wozRatio > 1.5) markt = 8;
    else if (wozRatio > 1.2) markt = 6;
    else if (wozRatio > 0.9) markt = 4;
    else markt = 3;
    markt = Math.min(10, Math.max(1, markt));

    // Liquiditeit
    let liquiditeit: number;
    if (input.typeWoning === 'vrijstaand') liquiditeit = 6;
    else if (input.typeWoning === 'commercieel') liquiditeit = 7;
    else if (input.typeWoning === 'appartement') liquiditeit = 3;
    else liquiditeit = 4;
    if (input.woonoppervlakte > 200) liquiditeit += 2;
    if (kad.isRijksmonument) liquiditeit += 2;
    liquiditeit = Math.min(10, Math.max(1, liquiditeit));

    const totaal = Math.round((locatie + staat + markt + liquiditeit) / 4);
    const advies = totaal <= 3
      ? 'Laag risico'
      : totaal <= 5
        ? 'Gemiddeld risico'
        : totaal <= 7
          ? 'Verhoogd risico'
          : 'Hoog risico';

    const adviesColor = totaal <= 3
      ? 'text-positive'
      : totaal <= 5
        ? 'text-warning'
        : totaal <= 7
          ? 'text-warning'
          : 'text-destructive';

    return { locatie, staat, markt, liquiditeit, totaal, advies, adviesColor };
  }, [input, kad]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Box 3 Calculator */}
        <div className="panel p-5 space-y-4">
          <div className={SECTION_HDR}>Box 3 Berekening (2024)</div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">WOZ waarde (€)</label>
              <input
                type="number"
                value={wozOverride}
                onChange={e => setWozOverride(Number(e.target.value) || 0)}
                min={0}
                className={INPUT_CLS}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Hypotheek / schuld (€)</label>
              <input
                type="number"
                value={hypotheek}
                onChange={e => setHypotheek(Number(e.target.value) || 0)}
                min={0}
                className={INPUT_CLS}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm">Fiscaal partners</span>
              <button
                type="button"
                onClick={() => setPartners(!partners)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  partners
                    ? 'bg-navy text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {partners ? 'Ja (2× vrij)' : 'Nee (1× vrij)'}
              </button>
            </div>
          </div>

          {/* Step-by-step breakdown */}
          <div className="border-t border-border pt-4 space-y-2">
            <Line k="WOZ waarde" v={fmtEUR(wozOverride)} />
            <Line k={`− Hypotheek / schuld`} v={`− ${fmtEUR(hypotheek)}`} color="text-destructive" />
            <Line
              k={`− Heffingsvrij (${partners ? '2×' : '1×'} €${(box3.heffingsvrij).toLocaleString('nl-NL')})`}
              v={`− ${fmtEUR(box3.heffingsvrij)}`}
              color="text-destructive"
            />
            <div className="border-t border-border pt-2">
              <Line k="= Belastbaar vermogen" v={fmtEUR(box3.belastbaarVermogen)} bold />
            </div>
            <Line
              k="× Fictief rendement 5,88%"
              v={`= ${fmtEUR(box3.fictiefRendement)}`}
            />
            <Line
              k="× Belastingtarief 36%"
              v={`= ${fmtEUR(box3.belasting)}/jaar`}
              bold
              color="text-destructive"
            />
            <div className="border-t border-border pt-2">
              <Line
                k="÷ 12 maanden"
                v={`= ${fmtEUR(box3.maandlast)}/mnd`}
                bold
                color="text-destructive"
              />
            </div>
          </div>

          {/* Summary box */}
          <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 mt-2">
            <div className="text-[10px] uppercase tracking-wide text-destructive/70 font-semibold mb-1">Jaarlijkse Box 3 last</div>
            <div className="text-2xl font-extrabold tabular text-destructive">{fmtEUR(box3.belasting)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{fmtEUR(box3.maandlast)}/maand · fictief rendement {fmtPct(5.88, 2)}</div>
          </div>
        </div>

        {/* Risicoscore */}
        <div className="panel p-5 space-y-4">
          <div className={SECTION_HDR}>Risicoscore</div>

          <div className="space-y-4">
            <RiskBar label="Locatierisico" score={risico.locatie} />
            <RiskBar label="Staat / conditierisico" score={risico.staat} />
            <RiskBar label="Marktrisico (prijs/WOZ)" score={risico.markt} />
            <RiskBar label="Liquiditeitsrisico" score={risico.liquiditeit} />
          </div>

          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">Totaalscore</span>
              <span className={`text-2xl font-extrabold tabular ${risico.adviesColor}`}>
                {risico.totaal}/10
              </span>
            </div>
            <div className={`text-sm font-bold ${risico.adviesColor}`}>{risico.advies}</div>

            {/* Toelichting per factor */}
            <div className="mt-4 space-y-2 text-xs text-muted-foreground">
              <div className="flex gap-1">
                <span className="font-medium text-foreground">Locatie:</span>
                <span>
                  {GROTE_STEDEN.includes(kad.gemeente ?? '') ? 'Grote stad (−1)' : 'Overige gemeente'}
                  {input.erfpacht ? ' · Erfpacht (+1)' : ''}
                </span>
              </div>
              <div className="flex gap-1">
                <span className="font-medium text-foreground">Staat:</span>
                <span>
                  Conditie: {input.conditie.replace('_', ' ')}
                  {['F', 'G', 'Onbekend'].includes(input.energielabel) ? ` · Label ${input.energielabel} (+1)` : ''}
                </span>
              </div>
              <div className="flex gap-1">
                <span className="font-medium text-foreground">Markt:</span>
                <span>
                  Vraagprijs/WOZ = {input.wozWaarde > 0 ? (input.vraagprijs / input.wozWaarde).toFixed(2) : '—'}×
                </span>
              </div>
              <div className="flex gap-1">
                <span className="font-medium text-foreground">Liquiditeit:</span>
                <span>
                  Type: {input.typeWoning}
                  {input.woonoppervlakte > 200 ? ' · >200m² (+2)' : ''}
                  {kad.isRijksmonument ? ' · Rijksmonument (+2)' : ''}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
