"use client";

import type { PropertyAnalysis } from "@/lib/types";
import { fmtEUR, fmtPct, getMarktwaarde, hasManualMarktwaarde } from "@/lib/calculations";

function RiskBar({ label, value }: { label: string; value: number }) {
  const color = value >= 7 ? "bg-destructive" : value >= 5 ? "bg-warning" : "bg-positive";
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular font-medium">{value}/10</span>
      </div>
      <div className="h-2 rounded bg-muted overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${value * 10}%` }} />
      </div>
    </div>
  );
}

export function OverviewTab({ a }: { a: PropertyAnalysis }) {
  const marktwaarde = getMarktwaarde(a);
  const manual = hasManualMarktwaarde(a);
  const vraag = a.listing?.prijs ?? marktwaarde;
  const afwijking = ((marktwaarde - vraag) / vraag) * 100;
  const afwColor =
    Math.abs(afwijking) < 5
      ? "text-muted-foreground"
      : afwijking > 0
        ? "text-positive"
        : "text-destructive";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 bg-card border rounded-lg p-5 space-y-4">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Investeringsthese</div>
          <p className="text-sm leading-relaxed">{a.ai.investeringsthese}</p>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Marktcontext</div>
          <p className="text-sm leading-relaxed text-muted-foreground">{a.ai.marktcontext}</p>
        </div>
        {a.ai.opmerkingen.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Opmerkingen</div>
            <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
              {a.ai.opmerkingen.map((o, i) => <li key={i}>{o}</li>)}
            </ul>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="bg-card border rounded-lg p-5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-3">Risicobeoordeling</div>
          <div className="space-y-3">
            <RiskBar label="Locatie" value={a.ai.risico.locatie} />
            <RiskBar label="Staat" value={a.ai.risico.staat} />
            <RiskBar label="Markt" value={a.ai.risico.markt} />
            <RiskBar label="Liquiditeit" value={a.ai.risico.liquiditeit} />
          </div>
        </div>

        <div className="bg-card border rounded-lg p-5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Prijs-validatie</div>
          <div className="space-y-1 text-sm tabular">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vraagprijs</span>
              <span>{fmtEUR(a.listing?.prijs)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Jouw marktwaarde</span>
              <span className="inline-flex items-center gap-2">
                {fmtEUR(marktwaarde)}
                {manual ? (
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-positive/15 text-positive border border-positive/40">Handmatig</span>
                ) : (
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-warning/15 text-warning border border-warning/40">WOZ × 1,15</span>
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Afwijking t.o.v. vraagprijs</span>
              <span className={afwColor}>{fmtPct(afwijking)}</span>
            </div>
            {!manual && (
              <div className="text-[11px] text-warning pt-2">
                Vul je eigen marktwaardeschatting in (bovenaan de pagina) voor accurate berekeningen.
              </div>
            )}
            {a.manual_overrides?.bijzonderheden && (
              <div className="pt-3 mt-2 border-t border-border">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Jouw bijzonderheden</div>
                <p className="text-[12px] leading-relaxed text-foreground">{a.manual_overrides.bijzonderheden}</p>
              </div>
            )}
          </div>
        </div>

        {(a.pandtype === "commercieel" || a.pandtype === "gemengd") &&
          (a.ai.bar_bruto || a.ai.nar_netto) && (
          <div className="bg-card border rounded-lg p-5">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Commercieel</div>
            <div className="space-y-1 text-sm tabular">
              <div className="flex justify-between">
                <span className="text-muted-foreground">BAR (bruto)</span>
                <span>{fmtPct(a.ai.bar_bruto)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">NAR (netto)</span>
                <span>{fmtPct(a.ai.nar_netto)}</span>
              </div>
              {a.ai.leegstandsrisico && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Leegstandsrisico</span>
                  <span className="capitalize">{a.ai.leegstandsrisico}</span>
                </div>
              )}
              {a.ai.huurprijszone && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Huurprijszone</span>
                  <span className="capitalize">{a.ai.huurprijszone}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
