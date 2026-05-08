'use client';
import { useState, useEffect } from 'react';
import { fmt } from '@/lib/utils';
import { berekenBox3 } from '@/lib/box3';

const inp = { width: '100%', padding: '6px 8px', border: '1px solid rgba(0,60,140,0.15)', borderRadius: 7, fontSize: 13, background: 'rgba(255,255,255,0.70)', color: '#0B1829', outline: 'none', fontFamily: 'Inter, sans-serif' };

export default function Acquisition({ d, onUpdate }) {
  const [bidPct,    setBidPct]    = useState(-5);
  const [taxPct,    setTaxPct]    = useState(10.4);
  const [notary,    setNotary]    = useState(3000);
  const [taxatie,   setTaxatie]   = useState(650);
  const [keuring,   setKeuring]   = useState(450);
  const [misc,      setMisc]      = useState(1000);
  const [hypotheek, setHypotheek] = useState(0);
  const [partners,  setPartners]  = useState(1);

  const bid      = d.price * (1 + bidPct / 100);
  const tax      = bid * (taxPct / 100);
  const totalAcq = bid + tax + notary + taxatie + keuring + misc;
  const diffFmv  = d.price - d.fair_value;

  useEffect(() => { onUpdate?.(totalAcq); }, [totalAcq]);

  const woz  = d.kadaster?.woz_huidig ?? d.fair_value ?? 0;
  const box3 = berekenBox3({ woz_huidig: woz, hypotheek, partners });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="note note-n" style={{ fontSize: 11 }}>
        Overdrachtsbelasting beleggers: <strong>10,4%</strong>. Eigen bewoning eerste woning tot €510.000: 2%.
      </div>
      {d.erfpacht === 'Ja' && (
        <div className="note note-r">
          Erfpacht gedetecteerd.{d.erfpacht_canon > 0 ? ` Jaarlijkse canon: €${d.erfpacht_canon.toLocaleString('nl-NL')}.` : ''} Controleer voorwaarden vóór het bieden.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="card">
          <div className="card-title">Bod & Aankoopkosten</div>
          <label style={{ fontSize: 11, color: '#3D5570' }}>Bod t.o.v. vraagprijs ({bidPct > 0 ? '+' : ''}{bidPct}%)</label>
          <input type="range" min={-15} max={5} step={0.5} value={bidPct} onChange={e => setBidPct(+e.target.value)} style={{ width: '100%', margin: '6px 0 14px', accentColor: '#1A56DB' }} />
          <label style={{ fontSize: 11, color: '#3D5570' }}>Overdrachtsbelasting ({taxPct.toFixed(1)}%)</label>
          <input type="range" min={2} max={10.4} step={0.1} value={taxPct} onChange={e => setTaxPct(+e.target.value)} style={{ width: '100%', margin: '6px 0 16px', accentColor: '#1A56DB' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            {[['Notaris (€)', notary, setNotary, 100], ['Taxatie (€)', taxatie, setTaxatie, 50], ['Keuring (€)', keuring, setKeuring, 50], ['Overig (€)', misc, setMisc, 100]].map(([l, val, set, step]) => (
              <div key={l}>
                <label style={{ fontSize: 11, color: '#3D5570' }}>{l}</label>
                <input type="number" value={val} step={step} onChange={e => set(+e.target.value)} style={{ ...inp, marginTop: 3 }} />
              </div>
            ))}
          </div>
          {[['Vraagprijs', fmt(d.price), '#0B1829'], [`Bod (${bidPct > 0 ? '+' : ''}${bidPct}%)`, fmt(bid), '#0B1829'], [`OVB ${taxPct.toFixed(1)}%`, fmt(tax), '#3D5570'], ['Notaris', fmt(notary), '#3D5570'], ['Taxatie', fmt(taxatie), '#3D5570'], ['Keuring', fmt(keuring), '#3D5570'], ['Overig', fmt(misc), '#3D5570']].map(([k, v, c]) => (
            <div className="row" key={k}><span className="rk">{k}</span><span className="rv" style={{ color: c }}>{v}</span></div>
          ))}
          <div className="row">
            <span style={{ fontWeight: 700, color: '#0B1829' }}>Totale aankoop</span>
            <span style={{ fontWeight: 700, color: '#1A56DB' }}>{fmt(totalAcq)}</span>
          </div>
          {diffFmv < 0
            ? <div className="note note-g" style={{ marginTop: 10 }}>{fmt(Math.abs(diffFmv))} onder marktwaarde — goed instapmoment.</div>
            : <div className="note note-y" style={{ marginTop: 10 }}>{fmt(diffFmv)} boven marktwaarde — onderhandel naar beneden.</div>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <div className="card-title">Marktcontext</div>
            {[['Marktwaarde', fmt(d.fair_value)], ['Vraagprijs', fmt(d.price)], ['Prijs per m²', fmt(Math.floor(d.price / Math.max(d.sqm, 1))) + '/m²'], ['Energielabel', d.energy], ['Staat', d.condition], ['Bouwjaar', String(d.year)]].map(([k, v]) => (
              <div className="row" key={k}><span className="rk">{k}</span><span className="rv">{v}</span></div>
            ))}
          </div>
          <div className="card">
            <div className="card-title">Box 3 vermogensbelasting</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div><label style={{ fontSize: 11, color: '#3D5570' }}>Hypotheek (€)</label><input type="number" value={hypotheek} step={10000} onChange={e => setHypotheek(+e.target.value)} style={{ ...inp, marginTop: 3 }} /></div>
              <div><label style={{ fontSize: 11, color: '#3D5570' }}>Fiscaal partners</label><select value={partners} onChange={e => setPartners(+e.target.value)} style={{ ...inp, marginTop: 3 }}><option value={1}>1 persoon</option><option value={2}>2 partners</option></select></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[['WOZ-waarde', fmt(woz)], ['Hypotheek', fmt(hypotheek)], ['Heffingsvrij', fmt(box3.heffingsvrij)], ['Belastbaar', fmt(box3.belastbaar_vermogen)], ['Jaarlijkse heffing', fmt(box3.jaarlijkse_heffing)], ['Per maand', fmt(box3.maandelijks)]].map(([k, v]) => (
                <div key={k} className="kad-box"><div className="kad-lbl">{k}</div><div className="kad-val">{v}</div></div>
              ))}
            </div>
            <div className="note note-n" style={{ marginTop: 10, fontSize: 11 }}>{box3.methode}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
