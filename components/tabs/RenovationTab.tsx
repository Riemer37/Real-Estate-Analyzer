"use client";

import { useMemo, useState } from "react";
import type { PropertyAnalysis } from "@/lib/types";
import { berekenRenovatiekosten, fmtEUR, getMarktwaarde } from "@/lib/calculations";

function Line({
  k,
  v,
  bold,
  color,
}: {
  k: string;
  v: string;
  bold?: boolean;
  color?: string;
}) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <span className="text-muted-foreground">{k}</span>
      <span className={color}>{v}</span>
    </div>
  );
}

export function RenovationTab({ a }: { a: PropertyAnalysis }) {
  const auto = useMemo(() => berekenRenovatiekosten(a), [a]);
  const [budget, setBudget] = useState(auto.totaal);
  const marktwaarde = getMarktwaarde(a);
  const factor = a.pandtype === "commercieel" ? 0.6 : 0.7;
  const waardestijging = Math.round(budget * factor);
  const arv = marktwaarde + waardestijging;
  const totaalInv = (a.listing?.prijs ?? marktwaarde) + budget + 15000;
  const marge = arv - totaalInv;
  const m2 = a.listing?.m2 ?? a.bag?.oppervlakte ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Budget input */}
        <div className="bg-card border rounded-lg p-5 space-y-3 lg:col-span-1">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Renovatiebudget</div>
          <input
            type="number"
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value) || 0)}
            className="w-full bg-background border rounded px-3 py-2 tabular text-lg font-semibold"
          />
          <div className="text-sm tabular space-y-1">
            <Line k={`Waardestijging (×${factor})`} v={fmtEUR(waardestijging)} />
            <Line k="ARV (na renovatie)" v={fmtEUR(arv)} />
            <Line k="Totaal investering" v={fmtEUR(totaalInv)} />
            <Line
              k="Gezonde marge"
              v={fmtEUR(marge)}
              bold
              color={marge >= 0 ? "text-positive" : "text-destructive"}
            />
          </div>
        </div>

        {/* Kostenspecificatie */}
        <div className="lg:col-span-2 bg-card border rounded-lg p-5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-3">
            Renovatiekosten — uitsplitsing
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground uppercase">
                <th className="text-left pb-2">Item</th>
                <th className="text-left pb-2">Prioriteit</th>
                <th className="text-right pb-2">Kosten</th>
              </tr>
            </thead>
            <tbody>
              {auto.items.map((it, i) => (
                <tr key={i} className="border-t">
                  <td className="py-2">{it.naam}</td>
                  <td className="py-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        it.prio === "Urgent"
                          ? "bg-destructive/15 text-destructive"
                          : it.prio === "Wenselijk"
                            ? "bg-warning/20 text-warning-foreground"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {it.prio}
                    </span>
                  </td>
                  <td className="py-2 text-right tabular">{fmtEUR(it.kosten)}</td>
                </tr>
              ))}
              <tr className="border-t font-semibold">
                <td className="py-2">Totaal</td>
                <td />
                <td className="py-2 text-right tabular">{fmtEUR(auto.totaal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Splitsingsscenario */}
      {(a.pandtype === "woning" || a.pandtype === "gemengd") && m2 >= 100 && (
        <div className="bg-card border rounded-lg p-5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
            Optimalisatiescenario: splitsing in 2 eenheden
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm tabular">
            <div>
              <div className="text-muted-foreground text-xs">Enkelvoudige verkoop</div>
              <div className="font-semibold">{fmtEUR(arv)}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Gesplitste verkoop (2× 60%)</div>
              <div className="font-semibold">{fmtEUR(arv * 1.2)}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Extra splitsingskosten</div>
              <div className="font-semibold">{fmtEUR(45000)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
