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

        <label style={{ fontSize: 11, color: '#6A8AAA' }}>Renovatiebudget (€)</label>
        <input
          type="number" value={reno} step={1000}
          onChange={e => setReno(+e.target.value)}
          style={{ width: '100%', padding: '6px 8px', border: '1px solid #1A3352', borderRadius: 7, fontSize: 13, margin: '6px 0 14px', background: '#0F2035', color: '#DCE8F5', outline: 'none', fontFamily: 'Inter, sans-serif' }}
        />

        {[
          ['Renovatiekosten',                    fmt(reno),                                         '#DCE8F5'],
          ['Kosten per m²',                      fmt(Math.floor(reno / Math.max(d.sqm, 1))) + '/m²','#6A8AAA'],
          ['Geschatte waardestijging',           '+' + fmt(uplift),                                 '#0EB876'],
          [`Gezonde marge (${d.healthy_margin}%)`, fmt(healthyMin),                                 '#A78BFA'],
          ['Totaal geïnvesteerd',                fmt(totalAcq + reno),                              '#2B7FFF'],
        ].map(([k, v, col]) => (
          <div className="row" key={k}><span className="rk">{k}</span><span className="rv" style={{ color: col }}>{v}</span></div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">Optimalisatiescenario's</div>
        {d.sqm >= 100 ? (() => {
          const u1v        = Math.floor(d.fair_value * 0.58);
          const u2v        = Math.floor(d.fair_value * 0.52);
          const splitCost  = d.sqm * 650;
          const splitTotal = u1v + u2v;
          const splitProfit = splitTotal - (totalAcq + reno + splitCost);
          return (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#DCE8F5', marginBottom: 12 }}>Scenario: splitsing in 2 eenheden</div>
              {[
                [`Eenheid A (~${Math.floor(d.sqm * 0.55)}m²)`, fmt(u1v),        '#DCE8F5'],
                [`Eenheid B (~${Math.floor(d.sqm * 0.45)}m²)`, fmt(u2v),        '#DCE8F5'],
                ['Splitsingskosten',                            fmt(splitCost),  '#6A8AAA'],
                ['Gecombineerde waarde',                        fmt(splitTotal), '#2B7FFF'],
                ['Splitsingswinst',                             fmt(splitProfit), splitProfit > 0 ? '#0EB876' : '#FF5252'],
              ].map(([k, v, c]) => (
                <div className="row" key={k}>
                  <span className="rk">{k}</span>
                  <span className="rv" style={{ color: c }}>{v}</span>
                </div>
              ))}
              <div className={`note ${splitProfit > (postReno - totalAcq - reno) ? 'note-g' : 'note-y'}`} style={{ marginTop: 10 }}>
                Splitsing levert {fmt(splitTotal - postReno)} meer op dan enkelvoudige verkoop.
              </div>
            </>
          );
        })() : (
          <div className="note note-n">Bij {d.sqm}m² is splitsing in meerdere eenheden waarschijnlijk niet haalbaar.</div>
        )}
      </div>
    </div>
  );
}
