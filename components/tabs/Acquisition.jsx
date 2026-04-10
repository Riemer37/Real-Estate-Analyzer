'use client';
import { useState, useEffect } from 'react';
import { fmt } from '@/lib/utils';
import { berekenBox3 } from '@/lib/box3';

// ── GEWIJZIGD: splitst kosten op in 4 aparte posten + Box 3 preview ──────────
export default function Acquisition({ d, onUpdate }) {
  const [bidPct,   setBidPct]   = useState(-5);
  const [taxPct,   setTaxPct]   = useState(10.4);
  const [notary,   setNotary]   = useState(3000);
  const [taxatie,  setTaxatie]  = useState(650);   // NIEUW: taxatiekosten
  const [keuring,  setKeuring]  = useState(450);   // NIEUW: bouwkundige keuring
  const [misc,     setMisc]     = useState(1000);  // overige (bank, hypotheekadvies etc.)
  const [hypotheek, setHypotheek] = useState(0);  // NIEUW: voor Box 3 berekening
  const [partners, setPartners] = useState(1);     // NIEUW: fiscaal partners

  const bid      = d.price * (1 + bidPct / 100);
  const tax      = bid * (taxPct / 100);
  const totalAcq = bid + tax + notary + taxatie + keuring + misc;
  const diffFmv  = d.price - d.fair_value;

  useEffect(() => { onUpdate?.(totalAcq); }, [totalAcq]);

  const erfpacht = d.erfpacht ?? 'Onbekend';
  const canon    = d.erfpacht_canon ?? 0;

  // NIEUW: Box 3 berekening op basis van WOZ en hypotheek
  const woz = d.kadaster?.woz_huidig ?? d.fair_value ?? 0;
  const box3 = berekenBox3({ woz_huidig: woz, hypotheek, partners });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── GEWIJZIGD: 10.4% toelichting voor beleggers ── */}
      <div className="note note-n" style={{ fontSize: 11 }}>
        Overdrachtsbelasting beleggers: <strong>10,4%</strong> (woningen die niet als hoofdverblijf dienen).
        Eigen bewoning eerste woning tot €510.000: 2%. Controleer altijd uw situatie bij de notaris.
      </div>

      {erfpacht === 'Ja' && (
        <div className="note note-r">
          Erfpacht gedetecteerd — de grond is niet in eigendom.{canon > 0 ? ` Jaarlijkse canon: €${canon.toLocaleString('nl-NL')}.` : ''} Controleer de erfpachtvoorwaarden en de canonherziening vóór het bieden.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="card">
          <div className="card-title">Bod & Aankoopkosten</div>

          <label style={{ fontSize: 12, color: '#71717A' }}>Bod t.o.v. vraagprijs ({bidPct > 0 ? '+' : ''}{bidPct}%)</label>
          <input type="range" min={-15} max={5} step={0.5} value={bidPct} onChange={e => setBidPct(+e.target.value)} style={{ width: '100%', margin: '6px 0 12px' }} />

          <label style={{ fontSize: 12, color: '#71717A' }}>Overdrachtsbelasting ({taxPct.toFixed(1)}%)</label>
          <input type="range" min={2} max={10.4} step={0.1} value={taxPct} onChange={e => setTaxPct(+e.target.value)} style={{ width: '100%', margin: '6px 0 14px' }} />

          {/* NIEUW: uitgesplitste kosten */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            {[
              ['Notaris & juridisch (€)', notary,  setNotary,  100],
              ['Taxatiekosten (€)',        taxatie, setTaxatie, 50],
              ['Bouwkundige keuring (€)',  keuring, setKeuring, 50],
              ['Overige kosten (€)',       misc,    setMisc,    100],
            ].map(([lbl, val, set, step]) => (
              <div key={lbl}>
                <label style={{ fontSize: 11, color: '#71717A' }}>{lbl}</label>
                <input type="number" value={val} step={step} onChange={e => set(+e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #E4E4E7', borderRadius: 6, fontSize: 13, marginTop: 3 }} />
              </div>
            ))}
          </div>

          {/* Kostenopbouw */}
          {[
            ['Vraagprijs',                    fmt(d.price)],
            [`Bod (${bidPct > 0 ? '+' : ''}${bidPct}%)`, fmt(bid)],
            [`Overdrachtsbelasting ${taxPct.toFixed(1)}%`, fmt(tax)],
            ['Notaris & juridisch',           fmt(notary)],
            ['Taxatie',                       fmt(taxatie)],
            ['Bouwkundige keuring',           fmt(keuring)],
            ['Overige kosten',                fmt(misc)],
          ].map(([k, v]) => (
            <div className="row" key={k}><span className="rk">{k}</span><span className="rv">{v}</span></div>
          ))}
          <div className="row">
            <span style={{ fontWeight: 600, color: '#1C1C1E' }}>Totale aankoop</span>
            <span style={{ fontWeight: 700, color: '#1D4ED8' }}>{fmt(totalAcq)}</span>
          </div>

          {diffFmv < 0
            ? <div className="note note-g" style={{ marginTop: 10 }}>{fmt(Math.abs(diffFmv))} onder marktwaarde — goed instapmoment.</div>
            : <div className="note note-y" style={{ marginTop: 10 }}>{fmt(diffFmv)} boven marktwaarde — onderhandel naar beneden.</div>
          }
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <div className="card-title">Marktcontext</div>
            {[
              ['Marktwaarde',   fmt(d.fair_value)],
              ['Vraagprijs',    fmt(d.price)],
              ['Prijs per m²',  fmt(Math.floor(d.price / Math.max(d.sqm, 1))) + '/m²'],
              ['Energielabel',  d.energy],
              ['Staat',         d.condition],
              ['Bouwjaar',      String(d.year)],
            ].map(([k, v]) => (
              <div className="row" key={k}><span className="rk">{k}</span><span className="rv">{v}</span></div>
            ))}
          </div>

          {/* NIEUW: Box 3 vermogensbelasting preview */}
          <div className="card">
            <div className="card-title">Box 3 vermogensbelasting (jaarlijks)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: '#71717A' }}>Hypotheek (€)</label>
                <input type="number" value={hypotheek} step={10000} onChange={e => setHypotheek(+e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #E4E4E7', borderRadius: 6, fontSize: 13, marginTop: 3 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#71717A' }}>Fiscaal partners</label>
                <select value={partners} onChange={e => setPartners(+e.target.value)}
                  style={{ width: '100%', padding: '7px 8px', border: '1px solid #E4E4E7', borderRadius: 6, fontSize: 13, marginTop: 3, background: '#fff' }}>
                  <option value={1}>1 persoon</option>
                  <option value={2}>2 partners</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                ['WOZ-waarde',        fmt(woz)],
                ['Hypotheek',         fmt(hypotheek)],
                ['Heffingsvrij',      fmt(box3.heffingsvrij)],
                ['Belastbaar',        fmt(box3.belastbaar_vermogen)],
                ['Jaarlijkse heffing', fmt(box3.jaarlijkse_heffing)],
                ['Per maand',         fmt(box3.maandelijks)],
              ].map(([k, v]) => (
                <div key={k} className="kad-box">
                  <div className="kad-lbl">{k}</div>
                  <div className="kad-val">{v}</div>
                </div>
              ))}
            </div>
            <div className="note note-n" style={{ marginTop: 10, fontSize: 11 }}>
              {box3.methode} · Tel dit op bij uw exploitatiekosten. Raadpleeg een belastingadviseur voor uw situatie.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
