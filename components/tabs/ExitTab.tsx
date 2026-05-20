"use client";

import { useMemo, useState } from "react";
import type { PropertyAnalysis } from "@/lib/types";
import {
  berekenBAR,
  berekenNAR,
  berekenRenovatiekosten,
  berekenWWS,
  fmtEUR,
  fmtPct,
  getMarktwaarde,
} from "@/lib/calculations";

function SubTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm rounded-t border-b-2 ${
        active ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}

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

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="text-xs space-y-1 block">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full bg-background border rounded px-2 py-1 tabular text-sm"
      />
    </label>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{k}</div>
      <div className="font-semibold">{v}</div>
    </div>
  );
}

function Verkoop({ a }: { a: PropertyAnalysis }) {
  const reno = useMemo(() => berekenRenovatiekosten(a), [a]);
  const marktwaarde = getMarktwaarde(a);
  const factor = a.pandtype === "commercieel" ? 0.6 : 0.7;
  const [arv, setArv] = useState(marktwaarde + Math.round(reno.totaal * factor));
  const aankoop = a.listing?.prijs ?? marktwaarde;
  const totaalInv = aankoop + reno.totaal + 15000;
  const makelaar = Math.round(arv * 0.015);
  const verkoopkosten = 2500;
  const winst = arv - totaalInv - makelaar - verkoopkosten;
  const roi = (winst / totaalInv) * 100;

  const segments = [
    { label: "Aankoop", value: aankoop, color: "var(--muted)" },
    { label: "Renovatie", value: reno.totaal, color: "var(--warning)" },
    { label: "Kosten", value: makelaar + verkoopkosten + 15000, color: "var(--destructive)" },
    { label: "Winst", value: Math.max(0, winst), color: "var(--positive)" },
  ];
  const total = segments.reduce((s, x) => s + x.value, 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="bg-card border rounded-lg p-5 space-y-3">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">After Repair Value (ARV)</div>
        <input
          type="number"
          value={arv}
          onChange={(e) => setArv(Number(e.target.value) || 0)}
          className="w-full bg-background border rounded px-3 py-2 tabular text-lg font-semibold"
        />
        <div className="text-sm tabular space-y-1 pt-2">
          <Line k="Waarde na renovatie" v={fmtEUR(arv)} />
          <Line k="Totaal geïnvesteerd" v={fmtEUR(totaalInv)} />
          <Line k="Makelaarskosten (1,5%)" v={fmtEUR(makelaar)} />
          <Line k="Verkoopkosten" v={fmtEUR(verkoopkosten)} />
          <Line k="Nettowinst" v={fmtEUR(winst)} bold color={winst >= 0 ? "text-positive" : "text-destructive"} />
          <Line k="ROI" v={fmtPct(roi)} bold color={roi >= 0 ? "text-positive" : "text-destructive"} />
        </div>
      </div>

      <div className="lg:col-span-2 bg-card border rounded-lg p-5">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-3">Winstopbouw (waterval)</div>
        <div className="flex items-end gap-2 h-44">
          {segments.map((s, i) => (
            <div key={i} className="flex-1 flex flex-col items-center justify-end">
              <div className="text-[10px] tabular text-muted-foreground mb-1">{fmtEUR(s.value)}</div>
              <div
                className="w-full rounded-t"
                style={{ height: `${(s.value / total) * 100}%`, background: s.color }}
              />
              <div className="text-[10px] mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Verhuur({ a }: { a: PropertyAnalysis }) {
  const [maandhuur, setMaandhuur] = useState(a.ai.huurwaarde_ai || 1500);
  const [jaarKosten, setJaarKosten] = useState(2500);
  const [leegstand, setLeegstand] = useState(5);
  const [stijging, setStijging] = useState(2);

  const aankoop = a.listing?.prijs ?? getMarktwaarde(a);
  const jaarhuur = maandhuur * 12 * (1 - leegstand / 100);
  const bruto = berekenBAR(jaarhuur, aankoop);
  const netto = berekenNAR(jaarhuur, aankoop);
  const cashOnCash = ((jaarhuur - jaarKosten) / aankoop) * 100;
  const terugverdien = aankoop / Math.max(1, jaarhuur - jaarKosten);
  const wws = berekenWWS(a);

  const jaren = 10;
  const cumulatief: number[] = [];
  let running = -aankoop;
  let waarde = aankoop;
  for (let y = 1; y <= jaren; y++) {
    running += jaarhuur - jaarKosten;
    waarde *= 1 + stijging / 100;
    cumulatief.push(running + (waarde - aankoop));
  }
  const minVal = Math.min(0, ...cumulatief, -aankoop);
  const maxVal = Math.max(...cumulatief, 0);
  const range = maxVal - minVal || 1;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="bg-card border rounded-lg p-5 space-y-3">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Verhuurparameters</div>
        <NumField label="Maandhuur" value={maandhuur} onChange={setMaandhuur} />
        <NumField label="Jaarlijkse kosten" value={jaarKosten} onChange={setJaarKosten} />
        <NumField label="Leegstand %" value={leegstand} onChange={setLeegstand} />
        <NumField label="Waardestijging % p.j." value={stijging} onChange={setStijging} />
        <div className="text-sm tabular space-y-1 pt-2">
          <Line k="BAR (bruto)" v={fmtPct(bruto)} bold />
          <Line k="NAR (netto)" v={fmtPct(netto)} />
          <Line k="Cash-on-cash" v={fmtPct(cashOnCash)} />
          <Line k="Terugverdientijd" v={`${terugverdien.toFixed(1)} jaar`} />
        </div>
      </div>

      <div className="lg:col-span-2 bg-card border rounded-lg p-5">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-3">Cumulatieve cashflow (10 jaar)</div>
        <svg viewBox="0 0 400 160" className="w-full h-40">
          <line
            x1="0" x2="400"
            y1={160 - ((-minVal) / range) * 160}
            y2={160 - ((-minVal) / range) * 160}
            stroke="var(--border)"
          />
          {cumulatief.map((v, i) => {
            const x = (i / (jaren - 1)) * 400;
            const y = 160 - ((v - minVal) / range) * 160;
            return <circle key={i} cx={x} cy={y} r="3" fill="var(--primary)" />;
          })}
          <polyline
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2"
            points={cumulatief
              .map((v, i) => `${(i / (jaren - 1)) * 400},${160 - ((v - minVal) / range) * 160}`)
              .join(" ")}
          />
        </svg>
        <div className="text-xs text-muted-foreground tabular flex justify-between mt-1">
          <span>Jaar 1</span>
          <span>Jaar 10: {fmtEUR(cumulatief[cumulatief.length - 1])}</span>
        </div>
      </div>

      {(a.pandtype === "woning" || a.pandtype === "gemengd") && (
        <div className="lg:col-span-3 bg-card border rounded-lg p-5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">WWS-puntentelling (indicatief)</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm tabular">
            <KV k="Punten" v={wws.punten.toString()} />
            <KV k="Max. huur" v={fmtEUR(wws.maxHuur)} />
            <KV k="Categorie" v={wws.categorie} />
            <KV k="Energie-punten" v={wws.breakdown.energie.toString()} />
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">Indicatief — geen officieel WWS-instrument.</p>
        </div>
      )}

      {a.pandtype === "commercieel" && (
        <div className="lg:col-span-3 bg-card border rounded-lg p-5 text-sm">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Commerciële huurindexering</div>
          <p className="text-muted-foreground">
            Standaard CPI-indexering + opslag onderhandelbaar (1-2% boven inflatie). Leegstandsrisico per zone: prime &lt; 5%, secondary 5-12%, perifeer &gt; 12%.
          </p>
        </div>
      )}
    </div>
  );
}

export function ExitTab({ a }: { a: PropertyAnalysis }) {
  const [tab, setTab] = useState<"verkoop" | "verhuur">("verkoop");
  return (
    <div>
      <div className="flex gap-1 mb-4">
        <SubTab active={tab === "verkoop"} onClick={() => setTab("verkoop")}>Verkopen na renovatie</SubTab>
        <SubTab active={tab === "verhuur"} onClick={() => setTab("verhuur")}>Verhuren</SubTab>
      </div>
      {tab === "verkoop" ? <Verkoop a={a} /> : <Verhuur a={a} />}
    </div>
  );
}
