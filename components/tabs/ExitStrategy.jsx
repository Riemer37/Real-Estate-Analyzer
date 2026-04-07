'use client';
import { useState } from 'react';
import { fmt } from '@/lib/utils';

export default function ExitStrategy({ d, totalAcq, reno, uplift, healthyMin }) {
  const totalInvested = totalAcq + reno;
  const postRenoVal   = d.fair_value + uplift;

  const [tab,         setTab]        = useState('sell');
  const [arv,         setArv]        = useState(Math.round(postRenoVal));
  const [monthlyRent, setMonthlyRent] = useState(d.monthly_rent);
  const [annualExp,   setAnnualExp]  = useState(2000);
  const [vacancy,     setVacancy]    = useState(3);
  const [appr,        setAppr]       = useState(2.5);

  // Sell
  const agent    = arv * 0.015;
  const costs    = arv * 0.005;
  const net      = arv - totalInvested - agent - costs;
  const roi      = totalInvested ? net / totalInvested * 100 : 0;
  const marginOk = net >= healthyMin;

  // Rent
  const effRent   = monthlyRent * 12 * (1 - vacancy / 100);
  const netAnnual = effRent - annualExp;
  const grossY    = postRenoVal ? monthlyRent * 12 / postRenoVal * 100 : 0;
  const netY      = postRenoVal ? netAnnual / postRenoVal * 100 : 0;
  const coc       = totalInvested ? netAnnual / totalInvested * 100 : 0;
  const payback   = netAnnual > 0 ? Math.floor(totalInvested / netAnnual) : 0;

  const cashflow = Array.from({ length: 10 }, (_, i) => ({
    year: i + 1,
    cum:  -totalInvested + netAnnual * (i + 1),
  }));
  const minCf  = Math.min(...cashflow.map(r => r.cum));
  const maxCf  = Math.max(...cashflow.map(r => r.cum));
  const range  = maxCf - minCf || 1;
  const chartH = 120;

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, background: '#F4F4F5', borderRadius: 10, padding: 4, marginBottom: 16, width: 'fit-content' }}>
        {[['sell', '🏷️ Sell after renovation'], ['rent', '🏘️ Rent out']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, background: tab === key ? '#fff' : 'transparent', color: tab === key ? '#1C1C1E' : '#71717A', boxShadow: tab === key ? '0 1px 3px rgba(0,0,0,.08)' : 'none' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'sell' && (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: '#71717A' }}>Estimated after-repair value (€)</label>
            <input type="number" value={arv} step={5000} onChange={e => setArv(+e.target.value)} style={{ width: 200, padding: '6px 8px', border: '1px solid #E4E4E7', borderRadius: 6, fontSize: 13, marginLeft: 8 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 16 }}>
            {[['After-repair value', fmt(arv), 'blue'], ['Total invested', fmt(totalInvested), ''], ['Agent & costs', fmt(agent + costs), ''], ['Net profit', fmt(net), net > 0 ? 'green' : 'red'], ['ROI', `${roi.toFixed(1)}%`, roi > 0 ? 'green' : 'red']].map(([lbl, val, cls]) => (
              <div className="kpi" key={lbl}><div className="kpi-l">{lbl}</div><div className={`kpi-v ${cls}`}>{val}</div></div>
            ))}
          </div>
          {net > 0 && (() => {
            const tw = totalAcq + reno + (agent + costs) + net;
            const wa = Math.max(Math.floor(totalAcq / tw * 100), 2);
            const wr = Math.max(Math.floor(reno / tw * 100), 2);
            const wc = Math.max(Math.floor((agent + costs) / tw * 100), 2);
            const wp = Math.max(100 - wa - wr - wc, 2);
            return (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#C0BDB8', marginBottom: 8 }}>Profit waterfall</div>
                <div className="wf">
                  <div className="ws" style={{ width: `${wa}%`, background: '#1D4ED8', color: '#fff' }}>Acq.</div>
                  <div className="ws" style={{ width: `${wr}%`, background: '#F59E0B', color: '#fff' }}>Reno.</div>
                  <div className="ws" style={{ width: `${wc}%`, background: '#EF4444', color: '#fff' }}>Costs</div>
                  <div className="ws" style={{ width: `${wp}%`, background: '#22C55E', color: '#fff' }}>Profit</div>
                </div>
                <div className="wf-leg">
                  {[['#1D4ED8', 'Acquisition', totalAcq], ['#F59E0B', 'Renovation', reno], ['#EF4444', 'Costs', agent + costs], ['#22C55E', 'Profit', net]].map(([bg, lbl, val]) => (
                    <span key={lbl}><span className="wf-dot" style={{ background: bg }} />{lbl} {fmt(val)}</span>
                  ))}
                </div>
              </div>
            );
          })()}
          {marginOk
            ? <div className="note note-g" style={{ marginTop: 12 }}>✓ Profit {fmt(net)} ({roi.toFixed(1)}% ROI) exceeds healthy margin of {fmt(healthyMin)} ({d.healthy_margin}%)</div>
            : net > 0
              ? <div className="note note-y" style={{ marginTop: 12 }}>Profitable but below healthy margin — reduce bid or renovation scope.</div>
              : <div className="note note-r" style={{ marginTop: 12 }}>✕ Deal does not work. Maximum viable bid: {fmt(arv - healthyMin - reno - (agent + costs))}</div>
          }
        </>
      )}

      {tab === 'rent' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: '#71717A' }}>Monthly rent (€)</label>
              <input type="number" value={monthlyRent} step={50} onChange={e => setMonthlyRent(+e.target.value)} style={{ width: '100%', padding: '6px 8px', border: '1px solid #E4E4E7', borderRadius: 6, fontSize: 13, margin: '4px 0 10px' }} />
              <label style={{ fontSize: 12, color: '#71717A' }}>Annual expenses (€)</label>
              <input type="number" value={annualExp} step={100} onChange={e => setAnnualExp(+e.target.value)} style={{ width: '100%', padding: '6px 8px', border: '1px solid #E4E4E7', borderRadius: 6, fontSize: 13, marginTop: 4 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#71717A' }}>Vacancy allowance ({vacancy}%)</label>
              <input type="range" min={0} max={10} step={0.5} value={vacancy} onChange={e => setVacancy(+e.target.value)} style={{ width: '100%', margin: '4px 0 12px' }} />
              <label style={{ fontSize: 12, color: '#71717A' }}>Annual appreciation ({appr}%)</label>
              <input type="range" min={0} max={6} step={0.5} value={appr} onChange={e => setAppr(+e.target.value)} style={{ width: '100%', marginTop: 4 }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 16 }}>
            {[['Monthly rent', fmt(monthlyRent), 'green'], ['Gross yield', `${grossY.toFixed(1)}%`, 'blue'], ['Net yield', `${netY.toFixed(1)}%`, 'blue'], ['Cash-on-cash ROI', `${coc.toFixed(1)}%`, 'green'], ['Payback', `${payback} yr`, '']].map(([lbl, val, cls]) => (
              <div className="kpi" key={lbl}><div className="kpi-l">{lbl}</div><div className={`kpi-v ${cls}`}>{val}</div></div>
            ))}
          </div>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#C0BDB8', marginBottom: 8 }}>10-year cumulative cashflow</div>
          <svg width="100%" height={chartH + 30} style={{ overflow: 'visible' }}>
            <polyline
              points={cashflow.map((r, i) => `${(i / 9) * 100}%,${chartH - ((r.cum - minCf) / range) * chartH}`).join(' ')}
              fill="none" stroke="#1D4ED8" strokeWidth={2}
            />
            {cashflow.map((r, i) => (
              <text key={i} x={`${(i / 9) * 100}%`} y={chartH + 20} textAnchor="middle" fontSize={9} fill="#A1A1AA">{r.year}</text>
            ))}
          </svg>
          {payback > 0 && <div className="note note-b" style={{ marginTop: 8 }}>Full investment recovered in approximately {payback} years at {fmt(monthlyRent)}/month.</div>}
        </>
      )}
    </div>
  );
}
