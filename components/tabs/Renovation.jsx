'use client';
import { useState } from 'react';
import { fmt } from '@/lib/utils';

export default function Renovation({ d, totalAcq, onUpdate }) {
  const [reno, setReno] = useState(d.reno_cost);

  const uplift     = reno * 0.7;
  const healthyMin = (totalAcq + reno) * (d.healthy_margin / 100);
  const postReno   = d.fair_value + uplift;

  onUpdate?.({ reno, uplift, healthyMin });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div className="card">
        <div className="card-title">Renovation Scope</div>
        <div className="note note-b" style={{ marginBottom: 12 }}>🔧 {d.reno_items}</div>
        <label style={{ fontSize: 12, color: '#71717A' }}>Renovation budget (€)</label>
        <input type="number" value={reno} step={1000} onChange={e => setReno(+e.target.value)} style={{ width: '100%', padding: '6px 8px', border: '1px solid #E4E4E7', borderRadius: 6, fontSize: 13, margin: '6px 0 12px' }} />
        {[
          ['Renovation cost',                   fmt(reno),                                    '#1C1C1E'],
          ['Cost per m²',                        fmt(Math.floor(reno / Math.max(d.sqm, 1))) + '/m²', '#1C1C1E'],
          ['Estimated value uplift',             '+' + fmt(uplift),                            '#15803D'],
          [`Healthy margin (${d.healthy_margin}%)`, fmt(healthyMin),                           '#6D28D9'],
          ['Total invested',                     fmt(totalAcq + reno),                         '#1D4ED8'],
        ].map(([k, v, col]) => (
          <div className="row" key={k}><span className="rk">{k}</span><span className="rv" style={{ color: col }}>{v}</span></div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">Optimisation Scenarios</div>
        {d.sqm >= 100 ? (() => {
          const u1v        = Math.floor(d.fair_value * 0.58);
          const u2v        = Math.floor(d.fair_value * 0.52);
          const splitCost  = d.sqm * 650;
          const splitTotal = u1v + u2v;
          const splitProfit = splitTotal - (totalAcq + reno + splitCost);
          return (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#1C1C1E', marginBottom: 10 }}>Split into 2 units scenario</div>
              {[
                [`Unit A (~${Math.floor(d.sqm * 0.55)}m²)`, fmt(u1v)],
                [`Unit B (~${Math.floor(d.sqm * 0.45)}m²)`, fmt(u2v)],
                ['Split conversion cost',                   fmt(splitCost)],
                ['Combined value',                          fmt(splitTotal)],
                ['Split profit',                            fmt(splitProfit)],
              ].map(([k, v]) => (
                <div className="row" key={k}>
                  <span className="rk">{k}</span>
                  <span className="rv" style={{ color: k.toLowerCase().includes('profit') ? '#15803D' : '#1C1C1E' }}>{v}</span>
                </div>
              ))}
              <div className={`note ${splitProfit > (postReno - totalAcq - reno) ? 'note-g' : 'note-y'}`} style={{ marginTop: 10 }}>
                Splitting adds {fmt(splitTotal - postReno)} vs single unit sale.
              </div>
            </>
          );
        })() : (
          <div className="note note-n">At {d.sqm}m² splitting into multiple units is unlikely to be viable.</div>
        )}
      </div>
    </div>
  );
}
