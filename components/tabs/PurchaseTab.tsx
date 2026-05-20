"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { PropertyAnalysis } from "@/lib/types";
import {
  berekenBox3,
  berekenMaxBod,
  berekenRenovatiekosten,
  fmtEUR,
  fmtPct,
  ovbTarief,
  maxBodBreakdown,
  getMarktwaarde,
} from "@/lib/calculations";

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="text-sm mb-1">{label}</div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
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

export function PurchaseTab({ a }: { a: PropertyAnalysis }) {
  const marktwaarde = getMarktwaarde(a);
  const vraag = a.listing?.prijs ?? marktwaarde;
  const [bodPct, setBodPct] = useState(0);
  const [eigenGebruik, setEigenGebruik] = useState(a.pandtype === "woning");
  const [notaris, setNotaris] = useState(1500);
  const [taxatie, setTaxatie] = useState(700);
  const [keuring, setKeuring] = useState(550);
  const [overig, setOverig] = useState(2500);
  const [roi, setRoi] = useState(10);
  const [hypotheek, setHypotheek] = useState(0);
  const [partners, setPartners] = useState(false);

  const reno = useMemo(() => berekenRenovatiekosten(a), [a]);
  const bod = Math.round(vraag * (1 + bodPct / 100));
  const ovbPct = ovbTarief(a.pandtype, eigenGebruik);
  const ovb = Math.round(bod * (ovbPct / 100));
  const bijkomend = notaris + taxatie + keuring + overig;
  const totaal = bod + ovb + bijkomend;
  const verschilMarktwaarde = bod - marktwaarde;
  const verschilPct = marktwaarde > 0 ? (verschilMarktwaarde / marktwaarde) * 100 : 0;
  const maxBod = berekenMaxBod(a, roi, reno.totaal, eigenGebruik);
  const margeMax = maxBod - vraag;
  const margePct = (margeMax / vraag) * 100;
  const box3 = berekenBox3(a.woz?.[0]?.waarde ?? marktwaarde, hypotheek, partners);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Bod-configurator */}
      <div className="bg-card border rounded-lg p-5 space-y-4">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Bod-configurator</div>
        <Slider
          label={`Bod: ${bodPct >= 0 ? "+" : ""}${bodPct}% (${fmtEUR(bod)})`}
          min={-15}
          max={5}
          step={1}
          value={bodPct}
          onChange={setBodPct}
        />

        <div className="flex items-center justify-between text-sm">
          <span>Eigen gebruik (woning)</span>
          <button
            onClick={() => setEigenGebruik(!eigenGebruik)}
            className={`px-3 py-1 rounded text-xs font-medium ${eigenGebruik ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            {eigenGebruik ? "Ja (2% OVB)" : "Nee (10,4% OVB)"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <NumField label="Notaris" value={notaris} onChange={setNotaris} />
          <NumField label="Taxatie" value={taxatie} onChange={setTaxatie} />
          <NumField label="Keuring" value={keuring} onChange={setKeuring} />
          <NumField label="Overig" value={overig} onChange={setOverig} />
        </div>

        <div className="border-t pt-3 space-y-1.5 text-sm tabular">
          <Line k="Bod" v={fmtEUR(bod)} />
          <Line k={`OVB (${ovbPct}%)`} v={fmtEUR(ovb)} />
          <Line k="Bijkomende kosten" v={fmtEUR(bijkomend)} />
          <Line k="Totaal aankoopsom" v={fmtEUR(totaal)} bold />
          <Line
            k="t.o.v. marktwaarde"
            v={`${fmtEUR(verschilMarktwaarde)} (${fmtPct(verschilPct)})`}
            color={verschilMarktwaarde < 0 ? "text-positive" : "text-destructive"}
          />
        </div>
      </div>

      <div className="space-y-4">
        {/* Max bod */}
        <div className="bg-card border rounded-lg p-5 space-y-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Max. bod calculator</div>
          <Slider
            label={`Gewenste ROI: ${roi}%`}
            min={0}
            max={30}
            step={0.5}
            value={roi}
            onChange={setRoi}
          />
          {(() => {
            const bd = maxBodBreakdown(a, roi, reno.totaal, eigenGebruik);
            const lowBidWarning = a.listing?.prijs && bd.bod < a.listing.prijs * 0.7;
            return (
              <>
                <div className="text-sm tabular space-y-1 border-t pt-3">
                  <Line k="Marktwaarde (basis)" v={fmtEUR(bd.marktwaarde)} />
                  <Line k="− Renovatiekosten" v={fmtEUR(bd.renovatie)} color="text-destructive" />
                  <Line k={`− OVB (${bd.ovbPct}%)`} v={fmtEUR(bd.ovb)} color="text-destructive" />
                  <Line k="− Notaris/taxatie/keuring" v={fmtEUR(bd.bijkomend)} color="text-destructive" />
                  <Line
                    k={`− ROI-buffer (${bd.gewensteROI}% × marktwaarde)`}
                    v={fmtEUR(bd.roiKorting)}
                    color="text-destructive"
                  />
                  <div className="border-t pt-2 mt-2">
                    <Line k="Maximaal bod" v={fmtEUR(bd.bod)} bold />
                  </div>
                  <Line
                    k="Marge t.o.v. vraagprijs"
                    v={`${fmtEUR(margeMax)} (${fmtPct(margePct)})`}
                    color={margeMax >= 0 ? "text-positive" : "text-destructive"}
                  />
                </div>
                {lowBidWarning && (
                  <div className="flex items-start gap-2 text-xs rounded border border-warning/40 bg-warning/10 text-warning p-2.5">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                    <span>
                      Het maximale bod ligt meer dan 30% onder de vraagprijs. Controleer of de
                      marktwaarde, renovatiekosten en ROI realistisch zijn.
                    </span>
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Box 3 / fiscaal */}
        <div className="bg-card border rounded-lg p-5 space-y-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {a.pandtype === "commercieel" ? "Fiscale impact (commercieel)" : "Box 3 calculator"}
          </div>
          {a.pandtype === "commercieel" ? (
            <p className="text-sm text-muted-foreground">
              Overweeg BV-structuur (VPB) i.p.v. privé. Afschrijving op gebouw mogelijk. Controleer
              BTW-belast vs. vrijgesteld huurcontract.
            </p>
          ) : (
            <>
              <NumField label="Hypotheek" value={hypotheek} onChange={setHypotheek} />
              <div className="flex items-center justify-between text-sm">
                <span>Fiscaal partners</span>
                <button
                  onClick={() => setPartners(!partners)}
                  className={`px-3 py-1 rounded text-xs font-medium ${partners ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                >
                  {partners ? "Ja" : "Nee"}
                </button>
              </div>
              <div className="text-sm tabular space-y-1">
                <Line k="Box 3 jaarlijks" v={fmtEUR(box3.jaarlijks)} bold />
                <Line k="Maandelijkse last" v={fmtEUR(box3.maandelijks)} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
