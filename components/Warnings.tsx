import { AlertTriangle } from "lucide-react";
import type { PropertyAnalysis } from "@/lib/types";

export function Warnings({ a }: { a: PropertyAnalysis }) {
  const items: { msg: string; level: "warn" | "info" | "danger" }[] = [];

  if (a.monument?.rijksmonument)
    items.push({ msg: "Rijksmonument — verbouwing vereist vergunning Rijksdienst voor het Cultureel Erfgoed.", level: "danger" });
  if (a.monument?.beschermdGezicht)
    items.push({ msg: `Beschermd stadsgezicht: ${a.monument.beschermdGezicht}. Wijzigingen exterieur beperkt mogelijk.`, level: "warn" });
  if (a.listing?.erfpacht)
    items.push({ msg: "Erfpacht — canon en looptijd controleren bij notaris.", level: "warn" });
  if ((a.bag?.vbos ?? 0) > 1)
    items.push({ msg: `Pand al gesplitst (${a.bag?.vbos} eenheden) — check VvE en splitsingsakte.`, level: "info" });
  if (a.pandtype === "commercieel" || a.pandtype === "gemengd")
    items.push({ msg: "Beleggerspand: OVB 10,4% van toepassing.", level: "info" });
  if (a.pandtype === "commercieel")
    items.push({ msg: "Controleer BTW-regime huurcontract (belast vs. vrijgesteld).", level: "info" });
  if (a.pandtype === "nieuwbouw")
    items.push({ msg: "Nieuwbouw — WOZ-waarde nog niet beschikbaar, prijsschatting op basis van AI-analyse.", level: "info" });
  if (a.errors && Object.keys(a.errors).length > 0) {
    for (const [k, v] of Object.entries(a.errors))
      items.push({ msg: `${k}: ${v}`, level: "warn" });
  }

  if (items.length === 0) return null;

  return (
    <div className="px-6 mb-3 space-y-2">
      {items.map((it, i) => (
        <div
          key={i}
          className={`flex items-start gap-2 text-sm rounded border px-3 py-2 ${
            it.level === "danger"
              ? "bg-destructive/10 border-destructive/30 text-destructive"
              : it.level === "warn"
                ? "bg-warning/10 border-warning/30 text-warning"
                : "bg-card border-border text-foreground/80"
          }`}
        >
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>{it.msg}</span>
        </div>
      ))}
    </div>
  );
}
