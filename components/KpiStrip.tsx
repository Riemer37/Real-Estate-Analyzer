import type { LucideIcon } from "lucide-react";
import { Home, TrendingUp, Hammer, Key, Shield, Percent } from "lucide-react";
import type { PropertyAnalysis } from "@/lib/types";
import { fmtEUR, fmtPct, berekenMaxBod, berekenRenovatiekosten, getMarktwaarde, hasManualMarktwaarde } from "@/lib/calculations";

function Tile({
  label,
  value,
  sub,
  color,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  icon: LucideIcon;
}) {
  return (
    <div className="panel navy-top lift p-4 relative">
      <div className="flex items-center justify-between mb-2">
        <span className="label-eyebrow">{label}</span>
        <Icon className="size-3.5 text-gold" />
      </div>
      <div className={`text-xl font-bold tabular display ${color ?? "text-navy"}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground tabular mt-1">{sub}</div>}
    </div>
  );
}

export function KpiStrip({ a }: { a: PropertyAnalysis }) {
  const reno = berekenRenovatiekosten(a);
  const maxBod = berekenMaxBod(a, 10, reno.totaal, a.pandtype === "woning");
  const vraag = a.listing?.prijs;
  const marktwaarde = getMarktwaarde(a);
  const manual = hasManualMarktwaarde(a);
  const marge = maxBod - (vraag ?? marktwaarde);
  const margePct = (marge / Math.max(1, vraag ?? marktwaarde)) * 100;
  const risico = Math.round(
    (a.ai.risico.locatie + a.ai.risico.staat + a.ai.risico.markt + a.ai.risico.liquiditeit) / 4,
  );
  const risicoColor = risico >= 7 ? "text-destructive" : risico >= 5 ? "text-warning" : "text-positive";
  const margeColor = marge >= 0 ? "text-positive" : "text-destructive";

  return (
    <div className="px-6 py-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 border-b border-border bg-background">
      <Tile icon={Home} label="Vraagprijs" value={vraag ? fmtEUR(vraag) : "—"} sub={vraag ? undefined : "Geen listing"} />
      <Tile
        icon={TrendingUp}
        label="Jouw marktwaarde"
        value={fmtEUR(marktwaarde)}
        sub={manual ? "Handmatig ingevoerd" : "Suggestie WOZ × 1,15"}
        color={manual ? undefined : "text-warning"}
      />
      <Tile icon={Hammer} label="Max. bod 10% ROI" value={fmtEUR(maxBod)} />
      <Tile
        icon={Key}
        label={a.pandtype === "commercieel" ? "Markthuur €/m²/jr" : "Markthuur p.m."}
        value={
          a.pandtype === "commercieel"
            ? fmtEUR(a.ai.commercieel_huurprijs_pm2 ?? 0)
            : fmtEUR(a.ai.huurwaarde_ai)
        }
      />
      <Tile icon={Shield} label="Risico" value={`${risico}/10`} color={risicoColor} />
      <Tile icon={Percent} label="Marge" value={fmtEUR(marge)} sub={fmtPct(margePct)} color={margeColor} />
    </div>
  );
}
