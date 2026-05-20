import { ExternalLink, MapPin } from "lucide-react";
import type { DataSource, PropertyAnalysis } from "@/lib/types";
import { SourceBadge } from "./SourceBadge";

const adviesStyle = (advies: string) => {
  if (advies === "Kopen") return "bg-positive/15 text-positive border-positive/40";
  if (advies === "Vermijden") return "bg-destructive/15 text-destructive border-destructive/40";
  return "bg-warning/15 text-warning border-warning/40";
};

const adviesLabel = (advies: string) => {
  if (advies === "Kopen") return "Sterke Koop";
  if (advies === "Vermijden") return "Vermijden";
  return "Voorwaardelijk";
};

const scoreRing = (score: number) => {
  if (score >= 7) return { color: "var(--positive)", glow: "glow-positive", text: "text-positive" };
  if (score >= 5) return { color: "var(--warning)", glow: "glow-warning", text: "text-warning" };
  return { color: "var(--destructive)", glow: "glow-danger", text: "text-destructive" };
};

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-border bg-muted text-[11px] font-medium text-foreground">
      {children}
    </span>
  );
}

function pandtypeLabel(a: PropertyAnalysis): string {
  if (a.pandtype === "commercieel") {
    const url = a.listing?.url ?? "";
    if (/fundainbusiness\.nl\/kantoor/i.test(url)) return "Kantoor";
    if (/fundainbusiness\.nl\/winkel/i.test(url)) return "Winkel";
    if (/fundainbusiness\.nl\/bedrijfsruimte/i.test(url)) return "Bedrijfsruimte";
    if (/fundainbusiness\.nl\/horeca/i.test(url)) return "Horeca";
    return "Commercieel";
  }
  return a.pandtype;
}

function ValuePill({ children, source }: { children: React.ReactNode; source?: DataSource }) {
  return (
    <Pill>
      <span className="inline-flex items-center gap-1.5">
        {children}
        <SourceBadge source={source} />
      </span>
    </Pill>
  );
}

export function PropertyHeader({ a }: { a: PropertyAnalysis }) {
  const fundaM2 = a.listing?.m2 && !a.listing.funda_debug?.blocked ? a.listing.m2 : undefined;
  const m2 = fundaM2 ?? a.bag?.oppervlakte ?? a.altum?.oppervlakte;
  const bouwjaar = a.bag?.bouwjaar ?? a.listing?.bouwjaar;
  const label = a.energielabel?.label ?? a.listing?.energielabel ?? "—";
  const bagUrl = a.pdok?.bagId
    ? `https://bagviewer.kadaster.nl/lvbag/bag-viewer/?objectId=${a.pdok.bagId}`
    : null;
  const ring = scoreRing(a.ai.score);
  const circ = 2 * Math.PI * 34;
  const dash = (a.ai.score / 10) * circ;

  return (
    <div className="border-b border-border px-6 py-6 relative overflow-hidden" style={{ background: "var(--gradient-header)" }}>
      <div className="absolute inset-0 pointer-events-none opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle at 20% 0%, var(--primary), transparent 50%)" }} />
      <div className="relative flex items-start justify-between gap-6 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="label-eyebrow flex items-center gap-1.5 mb-2">
            <MapPin className="size-3" />
            {a.pdok?.woonplaats ?? "Locatie"}
          </div>
          <h1 className="display text-2xl md:text-3xl font-bold tracking-tight truncate">
            {a.pdok?.adres ?? a.input}
          </h1>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Pill><span className="capitalize">{pandtypeLabel(a)}</span></Pill>
            {m2 ? (
              <ValuePill source={a.field_sources?.living_area_m2}>{m2} m²</ValuePill>
            ) : (
              <Pill><span className="text-muted-foreground">Oppervlakte onbekend</span></Pill>
            )}
            {a.listing?.kamers && (
              <ValuePill source={a.field_sources?.rooms}>{a.listing.kamers} kamers</ValuePill>
            )}
            {bouwjaar && (
              <ValuePill source={a.field_sources?.build_year}>Bouwjaar {bouwjaar}</ValuePill>
            )}
            <ValuePill source={a.field_sources?.energy_label}>
              <span className="text-gold font-semibold">Label {label}</span>
            </ValuePill>
            {a.listing?.url && (
              <a href={a.listing.url} target="_blank" rel="noreferrer">
                <Pill>
                  <span className="inline-flex items-center gap-1 text-primary">
                    Listing <ExternalLink className="size-3" />
                  </span>
                </Pill>
              </a>
            )}
            {bagUrl && (
              <a href={bagUrl} target="_blank" rel="noreferrer">
                <Pill>
                  <span className="inline-flex items-center gap-1 text-primary">
                    BAG <ExternalLink className="size-3" />
                  </span>
                </Pill>
              </a>
            )}
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className={`relative size-[92px] rounded-full ${ring.glow} flex items-center justify-center`}>
            <svg viewBox="0 0 80 80" className="absolute inset-0 size-full -rotate-90">
              <circle cx="40" cy="40" r="34" stroke="var(--border)" strokeWidth="6" fill="none" />
              <circle
                cx="40" cy="40" r="34"
                stroke={ring.color} strokeWidth="6" fill="none"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circ}`}
                style={{ transition: "stroke-dasharray .8s ease" }}
              />
            </svg>
            <div className="text-center">
              <div className={`text-2xl font-bold tabular ${ring.text}`}>{a.ai.score}</div>
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground -mt-0.5">/ 10</div>
            </div>
          </div>
          <div className="flex flex-col items-start gap-1.5">
            <span className="label-eyebrow">Verdict</span>
            <span className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider border ${adviesStyle(a.ai.advies)}`}>
              {adviesLabel(a.ai.advies)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
