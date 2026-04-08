'use client';
import { useState } from 'react';
import { fmt } from '@/lib/utils';
import { berekenWWS, WWS_SOCIAAL_GRENS, WWS_MIDDEN_GRENS } from '@/lib/wws';

export default function ExitStrategy({ d, totalAcq, reno, uplift, healthyMin }) {
  const totalInvested = totalAcq + reno;
  const postRenoVal   = d.fair_value + uplift;

  const [tab,          setTab]         = useState('sell');
  const [arv,          setArv]         = useState(Math.round(postRenoVal));
  const [monthlyRent,  setMonthlyRent] = useState(d.monthly_rent);
  const [annualExp,    setAnnualExp]   = useState(2000);
  const [vacancy,      setVacancy]     = useState(3);
  const [appr,         setAppr]        = useState(2.5);
  const [buitenruimte, setBuiten]      = useState(0);
  const [aanrechtCm,   setAanrecht]    = useState(200);
  const [toiletten,    setToiletten]   = useState(1);
  const [badkamers,    setBadkamers]   = useState(1);

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
        {[['sell', 'Verkopen na renovatie'], ['rent', 'Verhuren']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, background: tab === key ? '#fff' : 'transparent', color: tab === key ? '#1C1C1E' : '#71717A', boxShadow: tab === key ? '0 1px 3px rgba(0,0,0,.08)' : 'none' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'sell' && (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: '#71717A' }}>Geschatte waarde na renovatie (€)</label>
            <input type="number" value={arv} step={5000} onChange={e => setArv(+e.target.value)} style={{ width: 200, padding: '6px 8px', border: '1px solid #E4E4E7', borderRadius: 6, fontSize: 13, marginLeft: 8 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 16 }}>
            {[['Waarde na renovatie', fmt(arv), 'blue'], ['Totaal geïnvesteerd', fmt(totalInvested), ''], ['Makelaar & kosten', fmt(agent + costs), ''], ['Nettowinst', fmt(net), net > 0 ? 'green' : 'red'], ['ROI', `${roi.toFixed(1)}%`, roi > 0 ? 'green' : 'red']].map(([lbl, val, cls]) => (
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
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#C0BDB8', marginBottom: 8 }}>Winstopbouw</div>
                <div className="wf">
                  <div className="ws" style={{ width: `${wa}%`, background: '#1D4ED8', color: '#fff' }}>Aankoop</div>
                  <div className="ws" style={{ width: `${wr}%`, background: '#F59E0B', color: '#fff' }}>Reno.</div>
                  <div className="ws" style={{ width: `${wc}%`, background: '#EF4444', color: '#fff' }}>Kosten</div>
                  <div className="ws" style={{ width: `${wp}%`, background: '#22C55E', color: '#fff' }}>Winst</div>
                </div>
                <div className="wf-leg">
                  {[['#1D4ED8', 'Aankoop', totalAcq], ['#F59E0B', 'Renovatie', reno], ['#EF4444', 'Kosten', agent + costs], ['#22C55E', 'Winst', net]].map(([bg, lbl, val]) => (
                    <span key={lbl}><span className="wf-dot" style={{ background: bg }} />{lbl} {fmt(val)}</span>
                  ))}
                </div>
              </div>
            );
          })()}
          {marginOk
            ? <div className="note note-g" style={{ marginTop: 12 }}>Winst {fmt(net)} ({roi.toFixed(1)}% ROI) overstijgt de gezonde marge van {fmt(healthyMin)} ({d.healthy_margin}%)</div>
            : net > 0
              ? <div className="note note-y" style={{ marginTop: 12 }}>Winstgevend maar onder de gezonde marge — verlaag bod of renovatieomvang.</div>
              : <div className="note note-r" style={{ marginTop: 12 }}>Deal werkt niet bij deze parameters. Maximaal haalbaar bod: {fmt(arv - healthyMin - reno - (agent + costs))}</div>
          }
        </>
      )}

      {tab === 'rent' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: '#71717A' }}>Maandhuur (€)</label>
              <input type="number" value={monthlyRent} step={50} onChange={e => setMonthlyRent(+e.target.value)} style={{ width: '100%', padding: '6px 8px', border: '1px solid #E4E4E7', borderRadius: 6, fontSize: 13, margin: '4px 0 10px' }} />
              <label style={{ fontSize: 12, color: '#71717A' }}>Jaarlijkse kosten (€)</label>
              <input type="number" value={annualExp} step={100} onChange={e => setAnnualExp(+e.target.value)} style={{ width: '100%', padding: '6px 8px', border: '1px solid #E4E4E7', borderRadius: 6, fontSize: 13, marginTop: 4 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#71717A' }}>Leegstandsreserve ({vacancy}%)</label>
              <input type="range" min={0} max={10} step={0.5} value={vacancy} onChange={e => setVacancy(+e.target.value)} style={{ width: '100%', margin: '4px 0 12px' }} />
              <label style={{ fontSize: 12, color: '#71717A' }}>Jaarlijkse waardestijging ({appr}%)</label>
              <input type="range" min={0} max={6} step={0.5} value={appr} onChange={e => setAppr(+e.target.value)} style={{ width: '100%', marginTop: 4 }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 16 }}>
            {[['Maandhuur', fmt(monthlyRent), 'green'], ['Bruto rendement', `${grossY.toFixed(1)}%`, 'blue'], ['Netto rendement', `${netY.toFixed(1)}%`, 'blue'], ['Cash-on-cash ROI', `${coc.toFixed(1)}%`, 'green'], ['Terugverdientijd', `${payback} jr`, '']].map(([lbl, val, cls]) => (
              <div className="kpi" key={lbl}><div className="kpi-l">{lbl}</div><div className={`kpi-v ${cls}`}>{val}</div></div>
            ))}
          </div>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#C0BDB8', marginBottom: 8 }}>Cumulatieve cashflow over 10 jaar</div>
          <svg width="100%" height={chartH + 30} style={{ overflow: 'visible' }}>
            <polyline
              points={cashflow.map((r, i) => `${(i / 9) * 100}%,${chartH - ((r.cum - minCf) / range) * chartH}`).join(' ')}
              fill="none" stroke="#1D4ED8" strokeWidth={2}
            />
            {cashflow.map((r, i) => (
              <text key={i} x={`${(i / 9) * 100}%`} y={chartH + 20} textAnchor="middle" fontSize={9} fill="#A1A1AA">{r.year}</text>
            ))}
          </svg>
          {payback > 0 && <div className="note note-b" style={{ marginTop: 8 }}>Volledige investering terugverdiend in circa {payback} jaar bij {fmt(monthlyRent)}/maand.</div>}

          {/* WWS invoervelden */}
          <div style={{ background: '#FAFAF8', border: '1px solid #E4E4E7', borderRadius: 12, padding: '16px 20px', marginTop: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#C0BDB8', marginBottom: 12 }}>WWS-puntentelling — verfijn de berekening</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: '#71717A' }}>Buitenruimte (m²)</label>
                <input type="number" value={buitenruimte} min={0} step={1} onChange={e => setBuiten(+e.target.value)} style={{ width: '100%', padding: '5px 8px', border: '1px solid #E4E4E7', borderRadius: 6, fontSize: 12, marginTop: 3 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#71717A' }}>Aanrecht (cm)</label>
                <input type="number" value={aanrechtCm} min={60} step={30} onChange={e => setAanrecht(+e.target.value)} style={{ width: '100%', padding: '5px 8px', border: '1px solid #E4E4E7', borderRadius: 6, fontSize: 12, marginTop: 3 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#71717A' }}>Toiletten</label>
                <input type="number" value={toiletten} min={1} max={4} onChange={e => setToiletten(+e.target.value)} style={{ width: '100%', padding: '5px 8px', border: '1px solid #E4E4E7', borderRadius: 6, fontSize: 12, marginTop: 3 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#71717A' }}>Badkamers</label>
                <input type="number" value={badkamers} min={1} max={4} onChange={e => setBadkamers(+e.target.value)} style={{ width: '100%', padding: '5px 8px', border: '1px solid #E4E4E7', borderRadius: 6, fontSize: 12, marginTop: 3 }} />
              </div>
            </div>
          </div>

          {/* WWS invoer + puntentelling */}
          {(() => {
            const wws = berekenWWS({ sqm: d.sqm, energy: d.energy, woz_huidig: d.kadaster?.woz_huidig ?? 0, buitenruimte, aanrecht_cm: aanrechtCm, toiletten, badkamers });
            const barPct = Math.min(Math.round((wws.totaal / 250) * 100), 100);
            const col = wws.categorie === 'Vrije sector' ? '#15803D' : wws.categorie === 'Middenhuur' ? '#B45309' : '#B91C1C';
            return (
              <div style={{ marginTop: 16, background: '#fff', border: '1px solid #E4E4E7', borderRadius: 12, padding: '18px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#C0BDB8' }}>WWS-puntentelling (indicatief)</div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 99, background: col + '20', color: col }}>{wws.categorie}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{ flex: 1, height: 6, background: '#F4F4F5', borderRadius: 99, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: `${(WWS_SOCIAAL_GRENS/250)*100}%`, top: 0, bottom: 0, width: 1, background: '#E4E4E7' }} />
                    <div style={{ position: 'absolute', left: `${(WWS_MIDDEN_GRENS/250)*100}%`, top: 0, bottom: 0, width: 1, background: '#E4E4E7' }} />
                    <div style={{ width: `${barPct}%`, height: '100%', background: col, borderRadius: 99 }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: col, minWidth: 48 }}>{wws.totaal} pt</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, fontSize: 11, color: '#71717A' }}>
                  <span>Opp.: +{wws.breakdown.opp_pts} pt</span>
                  <span>Energielabel: {wws.breakdown.energie_pts >= 0 ? '+' : ''}{wws.breakdown.energie_pts} pt</span>
                  <span>WOZ: +{wws.breakdown.woz_pts} pt</span>
                </div>
                {wws.max_huur && (
                  <div className="note note-y" style={{ marginTop: 10 }}>
                    Max. toegestane huurprijs: <strong>€{wws.max_huur.toLocaleString('nl-NL')}/mnd</strong> — hogere huur is juridisch aanvechtbaar.
                  </div>
                )}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
