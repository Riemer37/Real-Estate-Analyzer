'use client';
import { useState } from 'react';
import { fmt } from '@/lib/utils';
import { berekenWWS, WWS_SOCIAAL_GRENS, WWS_MIDDEN_GRENS } from '@/lib/wws';
import { berekenBox3 } from '@/lib/box3';

const S2 = '#0F2035';
const B  = '#1A3352';
const B2 = '#152840';
const T1 = '#DCE8F5';
const T2 = '#6A8AAA';
const T3 = '#3D5A78';
const inp = { width: '100%', padding: '6px 8px', border: `1px solid ${B}`, borderRadius: 7, fontSize: 13, background: S2, color: T1, outline: 'none', fontFamily: 'Inter, sans-serif', marginTop: 4 };

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
  const [desiredRoi,   setDesiredRoi]  = useState(15);
  const [box3Hypo,     setBox3Hypo]    = useState(0);
  const [box3Partners, setBox3Partners] = useState(1);

  const agent    = arv * 0.015;
  const costs    = arv * 0.005;
  const net      = arv - totalInvested - agent - costs;
  const roi      = totalInvested ? net / totalInvested * 100 : 0;
  const marginOk = net >= healthyMin;

  const fixedAcqCosts = 5100;
  const totalInvMax   = arv * 0.98 / (1 + desiredRoi / 100);
  const maxBid        = Math.round((totalInvMax - reno - fixedAcqCosts) / 1.115);
  const maxBidVsVraag = maxBid - d.price;

  const effRent   = monthlyRent * 12 * (1 - vacancy / 100);
  const netAnnual = effRent - annualExp;
  const grossY    = postRenoVal ? monthlyRent * 12 / postRenoVal * 100 : 0;
  const netY      = postRenoVal ? netAnnual / postRenoVal * 100 : 0;
  const coc       = totalInvested ? netAnnual / totalInvested * 100 : 0;
  const payback   = netAnnual > 0 ? Math.floor(totalInvested / netAnnual) : 0;

  const woz          = d.kadaster?.woz_huidig ?? d.fair_value ?? 0;
  const box3         = berekenBox3({ woz_huidig: woz, hypotheek: box3Hypo, partners: box3Partners });
  const netAfterBox3 = netAnnual - box3.jaarlijkse_heffing;
  const netYBox3     = postRenoVal ? netAfterBox3 / postRenoVal * 100 : 0;

  const cashflow = Array.from({ length: 10 }, (_, i) => ({ year: i + 1, cum: -totalInvested + netAnnual * (i + 1) }));
  const minCf  = Math.min(...cashflow.map(r => r.cum));
  const maxCf  = Math.max(...cashflow.map(r => r.cum));
  const range  = maxCf - minCf || 1;
  const chartH = 100;

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `2px solid ${B2}`, marginBottom: 16 }}>
        {[['sell', 'Verkopen na renovatie'], ['rent', 'Verhuren']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ padding: '7px 16px', border: 'none', borderBottom: tab === key ? '2px solid #2B7FFF' : '2px solid transparent', marginBottom: -2, cursor: 'pointer', fontSize: 12, fontWeight: tab === key ? 700 : 500, background: 'transparent', color: tab === key ? '#2B7FFF' : T2, transition: 'color .15s' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'sell' && (
        <>
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ fontSize: 12, color: T2 }}>Geschatte waarde na renovatie (€)</label>
            <input type="number" value={arv} step={5000} onChange={e => setArv(+e.target.value)} style={{ width: 180, padding: '6px 8px', border: `1px solid ${B}`, borderRadius: 7, fontSize: 13, background: S2, color: T1, outline: 'none' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginBottom: 16 }}>
            {[
              ['Waarde na renovatie', fmt(arv),            'blue'],
              ['Totaal geïnvesteerd', fmt(totalInvested),  ''],
              ['Makelaar & kosten',   fmt(agent + costs),  ''],
              ['Nettowinst',          fmt(net),            net > 0 ? 'green' : 'red'],
              ['ROI',                 `${roi.toFixed(1)}%`, roi > 0 ? 'green' : 'red'],
            ].map(([l, v, cls]) => (
              <div className="kpi" key={l}><div className="kpi-l">{l}</div><div className={`kpi-v ${cls}`}>{v}</div></div>
            ))}
          </div>

          {net > 0 && (() => {
            const tw = totalAcq + reno + (agent + costs) + net;
            const wa = Math.max(Math.floor(totalAcq / tw * 100), 2);
            const wr = Math.max(Math.floor(reno / tw * 100), 2);
            const wc = Math.max(Math.floor((agent + costs) / tw * 100), 2);
            const wp = Math.max(100 - wa - wr - wc, 2);
            return (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: T3, marginBottom: 8 }}>Winstopbouw</div>
                <div className="wf">
                  <div className="ws" style={{ width: `${wa}%`, background: '#1A56DB', color: '#fff' }}>Aankoop</div>
                  <div className="ws" style={{ width: `${wr}%`, background: '#F5A020', color: '#fff' }}>Reno.</div>
                  <div className="ws" style={{ width: `${wc}%`, background: '#FF5252', color: '#fff' }}>Kosten</div>
                  <div className="ws" style={{ width: `${wp}%`, background: '#0EB876', color: '#fff' }}>Winst</div>
                </div>
                <div className="wf-leg">
                  {[['#1A56DB','Aankoop',totalAcq],['#F5A020','Renovatie',reno],['#FF5252','Kosten',agent+costs],['#0EB876','Winst',net]].map(([bg,lbl,val]) => (
                    <span key={lbl}><span className="wf-dot" style={{ background: bg }}/>{lbl} {fmt(val)}</span>
                  ))}
                </div>
              </div>
            );
          })()}

          {marginOk
            ? <div className="note note-g">Winst {fmt(net)} ({roi.toFixed(1)}% ROI) overstijgt de gezonde marge van {fmt(healthyMin)} ({d.healthy_margin}%)</div>
            : net > 0
              ? <div className="note note-y">Winstgevend maar onder de gezonde marge — verlaag bod of renovatieomvang.</div>
              : <div className="note note-r">Deal werkt niet bij deze parameters. Max. haalbaar bod: {fmt(arv - healthyMin - reno - (agent + costs))}</div>
          }

          {/* Max bod calculator */}
          <div style={{ background: S2, border: `1px solid ${B}`, borderRadius: 10, padding: '16px 20px', marginTop: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: T3, marginBottom: 12 }}>Maximaal bod voor gewenste ROI</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 12, color: T2 }}>Gewenste ROI ({desiredRoi}%)</label>
                <input type="range" min={5} max={40} step={1} value={desiredRoi} onChange={e => setDesiredRoi(+e.target.value)} style={{ width: 200, display: 'block', marginTop: 6, accentColor: '#2B7FFF' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: T3, marginBottom: 4 }}>Max. bod</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: maxBid > 0 ? '#2B7FFF' : '#FF5252', letterSpacing: -1, fontVariantNumeric: 'tabular-nums' }}>{maxBid > 0 ? fmt(maxBid) : 'Niet haalbaar'}</div>
                {maxBid > 0 && <div style={{ fontSize: 11, color: maxBidVsVraag < 0 ? '#0EB876' : '#F5A020', marginTop: 2 }}>{maxBidVsVraag < 0 ? `${fmt(Math.abs(maxBidVsVraag))} onder vraagprijs` : `${fmt(maxBidVsVraag)} boven vraagprijs`}</div>}
              </div>
            </div>
            <div style={{ fontSize: 10, color: T3 }}>Berekening: (ARV × 0,98 ÷ (1 + ROI%)) − renovatie − vaste kosten ÷ 1,115</div>
          </div>
        </>
      )}

      {tab === 'rent' && (
        <>
          {d.huur_methode && <div className="note note-b" style={{ marginBottom: 12, fontSize: 11 }}>Huurschatting via <strong>{d.huur_methode}</strong> — pas aan indien afwijkt van markt.</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: T2 }}>Maandhuur (€)</label>
              <input type="number" value={monthlyRent} step={50} onChange={e => setMonthlyRent(+e.target.value)} style={inp} />
              <label style={{ fontSize: 12, color: T2, marginTop: 10, display: 'block' }}>Jaarlijkse kosten (€)</label>
              <input type="number" value={annualExp} step={100} onChange={e => setAnnualExp(+e.target.value)} style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: T2 }}>Leegstandsreserve ({vacancy}%)</label>
              <input type="range" min={0} max={10} step={0.5} value={vacancy} onChange={e => setVacancy(+e.target.value)} style={{ width: '100%', margin: '6px 0 14px', accentColor: '#2B7FFF' }} />
              <label style={{ fontSize: 12, color: T2 }}>Jaarlijkse waardestijging ({appr}%)</label>
              <input type="range" min={0} max={6} step={0.5} value={appr} onChange={e => setAppr(+e.target.value)} style={{ width: '100%', marginTop: 6, accentColor: '#2B7FFF' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginBottom: 16 }}>
            {[
              ['Maandhuur',        fmt(monthlyRent),       'green'],
              ['Bruto rendement',  `${grossY.toFixed(1)}%`, 'blue'],
              ['Netto rendement',  `${netY.toFixed(1)}%`,   'blue'],
              ['Cash-on-cash ROI', `${coc.toFixed(1)}%`,    'green'],
              ['Terugverdientijd', `${payback} jr`,          ''],
            ].map(([l, v, cls]) => (
              <div className="kpi" key={l}><div className="kpi-l">{l}</div><div className={`kpi-v ${cls}`}>{v}</div></div>
            ))}
          </div>

          {/* Box 3 */}
          <div style={{ background: S2, border: `1px solid ${B}`, borderRadius: 10, padding: '16px 20px', marginBottom: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: T3, marginBottom: 12 }}>Box 3 belastingimpact op verhuurrendement</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: T2 }}>Hypotheek (€)</label>
                <input type="number" value={box3Hypo} step={10000} onChange={e => setBox3Hypo(+e.target.value)} style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: T2 }}>Fiscaal partners</label>
                <select value={box3Partners} onChange={e => setBox3Partners(+e.target.value)} style={inp}>
                  <option value={1}>1 persoon</option>
                  <option value={2}>2 partners</option>
                </select>
              </div>
              <div className="kad-box">
                <div className="kad-lbl">Box 3 heffing/jaar</div>
                <div className="kad-val" style={{ color: '#FF5252' }}>{fmt(box3.jaarlijkse_heffing)}</div>
                <div className="kad-sub">{fmt(box3.maandelijks)}/mnd</div>
              </div>
              <div className="kad-box">
                <div className="kad-lbl">Netto yield na belasting</div>
                <div className="kad-val" style={{ color: netYBox3 > 3 ? '#0EB876' : '#F5A020' }}>{netYBox3.toFixed(1)}%</div>
                <div className="kad-sub">Was {netY.toFixed(1)}% voor Box 3</div>
              </div>
            </div>
            <div className="note note-n" style={{ fontSize: 11 }}>WOZ {fmt(woz)} × {box3.rendement_pct}% fictief rendement × 36% = {fmt(box3.jaarlijkse_heffing)}/jaar · {box3.methode}</div>
          </div>

          {/* Cashflow grafiek */}
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: T3, marginBottom: 8 }}>Cumulatieve cashflow over 10 jaar</div>
          <div style={{ background: S2, border: `1px solid ${B2}`, borderRadius: 10, padding: '16px 20px', marginBottom: 12 }}>
            <svg width="100%" height={chartH + 30} style={{ overflow: 'visible' }}>
              <line x1="0" y1={chartH - ((0 - minCf) / range) * chartH} x2="100%" y2={chartH - ((0 - minCf) / range) * chartH} stroke={B} strokeWidth={1} strokeDasharray="4 4" />
              <polyline
                points={cashflow.map((r, i) => `${(i / 9) * 100}%,${chartH - ((r.cum - minCf) / range) * chartH}`).join(' ')}
                fill="none" stroke="#2B7FFF" strokeWidth={2}
              />
              {cashflow.map((r, i) => (
                <g key={i}>
                  <circle cx={`${(i / 9) * 100}%`} cy={chartH - ((r.cum - minCf) / range) * chartH} r={3} fill={r.cum >= 0 ? '#0EB876' : '#FF5252'} />
                  <text x={`${(i / 9) * 100}%`} y={chartH + 20} textAnchor="middle" fontSize={9} fill={T3}>{r.year}</text>
                </g>
              ))}
            </svg>
          </div>

          {payback > 0 && <div className="note note-b" style={{ marginBottom: 16 }}>Investering terugverdiend in circa <strong>{payback} jaar</strong> bij {fmt(monthlyRent)}/maand.</div>}

          {/* WWS */}
          <div style={{ background: S2, border: `1px solid ${B}`, borderRadius: 10, padding: '16px 20px', marginBottom: 12 }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: T3, marginBottom: 12 }}>WWS-puntentelling — verfijn de berekening</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
              {[['Buitenruimte (m²)',buitenruimte,setBuiten,0,1],['Aanrecht (cm)',aanrechtCm,setAanrecht,60,30],['Toiletten',toiletten,setToiletten,1,1],['Badkamers',badkamers,setBadkamers,1,1]].map(([l,val,set,min,step]) => (
                <div key={l}>
                  <label style={{ fontSize: 11, color: T2 }}>{l}</label>
                  <input type="number" value={val} min={min} step={step} onChange={e => set(+e.target.value)} style={inp} />
                </div>
              ))}
            </div>
          </div>

          {(() => {
            const wws = berekenWWS({ sqm: d.sqm, energy: d.energy, woz_huidig: d.kadaster?.woz_huidig ?? 0, buitenruimte, aanrecht_cm: aanrechtCm, toiletten, badkamers });
            const barPct = Math.min(Math.round((wws.totaal / 250) * 100), 100);
            const col = wws.categorie === 'Vrije sector' ? '#0EB876' : wws.categorie === 'Middenhuur' ? '#F5A020' : '#FF5252';
            const bg  = wws.categorie === 'Vrije sector' ? '#0A2A1A' : wws.categorie === 'Middenhuur' ? '#2D1E05' : '#2D0C0C';
            return (
              <div style={{ background: S2, border: `1px solid ${B}`, borderRadius: 10, padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: T3 }}>WWS-puntentelling (indicatief)</div>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 10px', borderRadius: 99, background: bg, color: col, textTransform: 'uppercase', letterSpacing: '.04em' }}>{wws.categorie}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{ flex: 1, height: 5, background: B, borderRadius: 99, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: `${(WWS_SOCIAAL_GRENS/250)*100}%`, top: 0, bottom: 0, width: 1, background: B }} />
                    <div style={{ position: 'absolute', left: `${(WWS_MIDDEN_GRENS/250)*100}%`, top: 0, bottom: 0, width: 1, background: B }} />
                    <div style={{ width: `${barPct}%`, height: '100%', background: col, borderRadius: 99 }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: col, minWidth: 48 }}>{wws.totaal} pt</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, fontSize: 11, color: T2 }}>
                  <span>Opp.: +{wws.breakdown.opp_pts} pt</span>
                  <span>Energielabel: {wws.breakdown.energie_pts >= 0 ? '+' : ''}{wws.breakdown.energie_pts} pt</span>
                  <span>WOZ: +{wws.breakdown.woz_pts} pt</span>
                </div>
                {wws.max_huur && <div className="note note-y" style={{ marginTop: 10 }}>Max. toegestane huurprijs: <strong>€{wws.max_huur.toLocaleString('nl-NL')}/mnd</strong> — hogere huur is juridisch aanvechtbaar.</div>}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
