"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { PropertyAnalysis, StaatVanOnderhoud } from "@/lib/types";
import { fmtEUR, hasManualMarktwaarde, suggestedMarktwaarde } from "@/lib/calculations";

const STAAT_OPTIONS: { value: StaatVanOnderhoud; label: string }[] = [
  { value: "uitstekend", label: "Uitstekend" },
  { value: "goed", label: "Goed" },
  { value: "redelijk", label: "Redelijk" },
  { value: "slecht", label: "Slecht" },
];

export function MyEstimate({
  a,
  onUpdate,
}: {
  a: PropertyAnalysis;
  onUpdate: (next: PropertyAnalysis) => void;
}) {
  const suggestion = suggestedMarktwaarde(a);
  const filledIn = hasManualMarktwaarde(a);

  const [marktwaarde, setMarktwaarde] = useState<number | "">(
    a.manual_overrides?.marktwaarde ?? "",
  );
  const [staat, setStaat] = useState<string>(a.manual_overrides?.staat ?? "");
  const [bijzonderheden, setBijzonderheden] = useState<string>(
    a.manual_overrides?.bijzonderheden ?? "",
  );

  useEffect(() => {
    setMarktwaarde(a.manual_overrides?.marktwaarde ?? "");
    setStaat(a.manual_overrides?.staat ?? "");
    setBijzonderheden(a.manual_overrides?.bijzonderheden ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.id]);

  const commit = (patch: Partial<NonNullable<PropertyAnalysis["manual_overrides"]>>) => {
    onUpdate({
      ...a,
      manual_overrides: { ...(a.manual_overrides ?? {}), ...patch },
    });
  };

  return (
    <div className="px-6 pt-5">
      <div
        className={`panel border-2 ${
          filledIn ? "border-positive/40" : "border-warning/60"
        } shadow-elevated p-5`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="label-eyebrow flex items-center gap-2">
            {filledIn ? (
              <CheckCircle2 className="size-4 text-positive" />
            ) : (
              <AlertTriangle className="size-4 text-warning" />
            )}
            Jouw inschatting
            <span className="text-muted-foreground normal-case tracking-normal font-normal">
              (vereist voor accurate berekeningen)
            </span>
          </div>
        </div>

        {!filledIn && (
          <div className="mb-4 text-xs rounded border border-warning/40 bg-warning/10 text-warning-foreground p-2.5 flex items-start gap-2">
            <AlertTriangle className="size-4 shrink-0 mt-0.5 text-warning" />
            <span className="text-foreground">
              Vul je eigen marktwaardeschatting in voor accurate berekeningen (max bod, ROI,
              exitstrategie).
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Marktwaarde
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                €
              </span>
              <input
                type="number"
                inputMode="numeric"
                value={marktwaarde}
                placeholder={String(suggestion || "")}
                onChange={(e) => {
                  const raw = e.target.value;
                  setMarktwaarde(raw === "" ? "" : Number(raw));
                }}
                onBlur={() => {
                  const v = typeof marktwaarde === "number" ? marktwaarde : undefined;
                  commit({ marktwaarde: v && v > 0 ? Math.round(v) : undefined });
                }}
                className="w-full bg-background border border-border rounded-md pl-7 pr-3 py-2 tabular text-lg font-semibold"
              />
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              {filledIn
                ? `Suggestie WOZ × 1,15: ${fmtEUR(suggestion)}`
                : `Suggestie op basis van WOZ × 1,15: ${fmtEUR(suggestion)} — pas aan op basis van jouw inschatting.`}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Staat van onderhoud
            </label>
            <select
              value={staat}
              onChange={(e) => {
                const v = e.target.value;
                setStaat(v);
                commit({ staat: v || undefined });
              }}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm font-medium"
            >
              <option value="">Kies staat…</option>
              {STAAT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Gebaseerd op foto&apos;s en omschrijving. Beïnvloedt de renovatiebegroting.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Bijzonderheden
            </label>
            <textarea
              value={bijzonderheden}
              onChange={(e) => setBijzonderheden(e.target.value)}
              onBlur={() => commit({ bijzonderheden: bijzonderheden || undefined })}
              placeholder="Bijv. &quot;veel achterstallig onderhoud zichtbaar op foto's&quot;"
              rows={3}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm leading-snug resize-y"
            />
            <p className="text-[11px] text-muted-foreground leading-snug">
              Wat valt je op aan de listing of locatie?
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
