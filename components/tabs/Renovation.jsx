'use client';
import { useState, useEffect } from 'react';
import { fmt } from '@/lib/utils';

export default function Renovation({ d, totalAcq, onUpdate }) {
  const [reno, setReno] = useState(d.reno_cost);
  const uplift     = reno * 0.7;
  const healthyMin = (totalAcq + reno) * (d.healthy_margin / 100);
  const postReno   = d.fair_value + uplift;
  useEffect(() => { onUpdate?.({ reno, uplift, healthyMin }); }, [reno, totalAcq]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div className="card">
        <div className="card-title">Renovatiescope</div>
        <div className="note note-b" style={{ marginBottom: 12 }}>{d.reno_items}</div>
        <label style={{ fontSize: 11, color: '#3D5570' }}>Renovatiebudget (€)</label>
        <input type="number" value={reno} step={1000} onChange={e => setReno(+e.target.value)}
          style={{ width: '100%', padding: '6px 8px', border: '1px solid rgba(0,60,140,0.15)', borderRadius: 7, fontSize: 13, margin: '6px 0 14px', background: 'rgba(255,255,255,0.70)', color: '#0B1829', outline: 'none' }} />
        {[
          ['Renovatiekosten',                      fmt(reno),                                          '#0B1829'],
          ['Kosten per m²',                        fmt(Math.floor(reno / Math.max(d.sqm,1)))+'/m²',   '#3D5570'],
          ['Geschatte waardestijging',             '+'+fmt(uplift),                                    '#0A7A4F'],
          [`Gezonde marge (${d.healthy_margin}%)`, fmt(healthyMin),                                    '#6D28D9'],
          ['Totaal geïnvesteerd',                  fmt(totalAcq + reno),                               '#1A56DB'],
        ].map(([k,v,c]) => (
          <div className="row" key={k}><span className="rk">{k}</span><span className="rv" style={{ color: c }}>{v}</span></div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">Optimalisatiescenario's</div>
        {d.sqm >= 100 ? (() => {
          const u1v = Math.floor(d.fair_value * 0.58);
          const u2v = Math.floor(d.fair_value * 0.52);
          const splitCost = d.sqm * 650;
          const splitTotal = u1v + u2v;
          const splitProfit = splitTotal - (totalAcq + reno + splitCost);
          return (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0B1829', marginBottom: 12 }}>Scenario: splitsing in 2 eenheden</div>
              {[[`Eenheid A (~${Math.floor(d.sqm*.55)}m²)`,fmt(u1v),'#0B1829'],[`Eenheid B (~${Math.floor(d.sqm*.45)}m²)`,fmt(u2v),'#0B1829'],['Splitsingskosten',fmt(splitCost),'#3D5570'],['Gecombineerde waarde',fmt(splitTotal),'#1A56DB'],['Splitsingswinst',fmt(splitProfit),splitProfit>0?'#0A7A4F':'#B91C1C']].map(([k,v,c]) => (
                <div className="row" key={k}><span className="rk">{k}</span><span className="rv" style={{ color: c }}>{v}</span></div>
              ))}
              <div className={`note ${splitProfit>(postReno-totalAcq-reno)?'note-g':'note-y'}`} style={{ marginTop: 10 }}>
                Splitsing levert {fmt(splitTotal-postReno)} meer op dan enkelvoudige verkoop.
              </div>
            </>
          );
        })() : <div className="note note-n">Bij {d.sqm}m² is splitsing niet haalbaar.</div>}
      </div>
    </div>
  );
}
