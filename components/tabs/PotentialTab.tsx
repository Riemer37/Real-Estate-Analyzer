"use client";

import type { PropertyAnalysis } from "@/lib/types";
import { berekenPotentieel } from "@/lib/calculations";

function KansCard({
  titel,
  score,
  toelichting,
  blokkers,
}: {
  titel: string;
  score: number;
  toelichting: string;
  blokkers?: string[];
}) {
  const color = score >= 7 ? "text-positive" : score >= 4 ? "text-warning" : "text-destructive";
  return (
    <div className="bg-card border rounded-lg p-5">
      <div className="flex items-start justify-between">
        <div className="text-sm font-semibold">{titel}</div>
        <div className={`text-2xl font-bold tabular ${color}`}>{score}/10</div>
      </div>
      <p className="text-sm text-muted-foreground mt-2">{toelichting}</p>
      {blokkers && blokkers.length > 0 && (
        <ul className="text-xs text-destructive mt-2 list-disc list-inside">
          {blokkers.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
      )}
    </div>
  );
}

export function PotentialTab({ a }: { a: PropertyAnalysis }) {
  const p = berekenPotentieel(a);
  const m2 = a.listing?.m2 ?? a.bag?.oppervlakte ?? 0;
  const monument = a.monument?.rijksmonument;
  const beschermd = !!a.monument?.beschermdGezicht;
  const erfpacht = a.listing?.erfpacht;

  const blokkersSplitsen: string[] = [];
  if (m2 < 100) blokkersSplitsen.push(`Te klein (${m2} m² < 100 m²)`);
  if (monument) blokkersSplitsen.push("Rijksmonument blokkeert splitsing");

  const blokkersOptoppen: string[] = [];
  if (beschermd) blokkersOptoppen.push("Beschermd gezicht beperkt optoppen");
  if (monument) blokkersOptoppen.push("Rijksmonument blokkeert dakopbouw");

  const blokkersAanbouw: string[] = [];
  if (erfpacht) blokkersAanbouw.push("Erfpacht beperkt mogelijkheden");

  const beleid = a.pdok?.gemeente
    ? ["Amsterdam", "Utrecht"].includes(a.pdok.gemeente)
      ? "Streng"
      : ["Rotterdam", "Den Haag"].includes(a.pdok.gemeente)
        ? "Gemiddeld"
        : "Soepel"
    : "Onbekend";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Gemeentelijk beleid:</span>
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium ${
            beleid === "Streng"
              ? "bg-destructive/20 text-destructive"
              : beleid === "Gemiddeld"
                ? "bg-warning/20 text-warning-foreground"
                : "bg-positive/20 text-positive"
          }`}
        >
          {beleid}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <KansCard
          titel="Splitsen"
          score={p.splitsen}
          toelichting={`Op basis van m² (${m2}), monumentstatus en bouwtype.`}
          blokkers={blokkersSplitsen}
        />
        <KansCard
          titel="Optoppen"
          score={p.optoppen}
          toelichting="Dakopbouw of extra verdieping toevoegen."
          blokkers={blokkersOptoppen}
        />
        <KansCard
          titel="Balkon toevoegen"
          score={p.balkon}
          toelichting="Buitenruimte verhoogt huur- en verkoopwaarde aanzienlijk."
        />
        <KansCard
          titel="Aanbouw / uitbouw"
          score={p.aanbouw}
          toelichting="Op basis van perceeloppervlakte en bestemmingsplan."
          blokkers={blokkersAanbouw}
        />
        {a.pandtype === "commercieel" && (
          <KansCard
            titel="Woningconversie"
            score={p.conversie}
            toelichting="Mits het bestemmingsplan dit toelaat — vraag bij gemeente na."
          />
        )}
      </div>

      <div className="bg-card border rounded-lg p-5">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Transformatieadvies (AI)</div>
        <p className="text-sm leading-relaxed">{a.ai.transformatieadvies}</p>
      </div>
    </div>
  );
}
