'use client';
import { useState } from 'react';
import { fmt } from '@/lib/utils';
import { berekenWWS, WWS_SOCIAAL_GRENS, WWS_MIDDEN_GRENS } from '@/lib/wws';
import { berekenBox3 } from '@/lib/box3';

const inp = { width: '100%', padding: '6px 8px', border: '1px solid rgba(0,60,140,0.15)', borderRadius: 7, fontSize: 13, background: 'rgba(255,255,255,0.70)', color: '#0B1829', outline: 'none', fontFamily: 'Inter, sans-serif', marginTop: 4 };
const box = { background: 'rgba(255,255,255,0.65)', border: '1px solid rgba(0,60,140,0.12)', borderRadius: 10, padding: '16px 20px' };

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

  const agent = arv * 0.015, costs = arv * 0.005;
  const net = arv - totalInvested - agent - costs;
  const roi = totalInvested ? net / totalInvested * 100 : 0;
  const marginOk = net >= healthyMin;
  const fixedAcqCosts = 5100;
  const maxBid = Math.round((arv * 0.98 / (1 + desiredRoi / 100) - reno - fixedAcqCosts) / 1.115);
  const maxBidVsVraag = maxBid - d.price;

  const effRent = monthlyRent * 12 * (1 - vacancy / 100);
  const netAnnual = effRent - annualExp;
  const grossY = postRenoVal ? monthlyRent * 12 / postRenoVal * 100 : 0;
  const netY   = postRenoVal ? netAnnual / postRenoVal * 100 : 0;
  const coc    = totalInvested ? netAnnual / totalInvested * 100 : 0;
  const payback = netAnnual > 0 ? Math.floor(totalInvested / netAnnual) : 0;

  const woz = d.kadaster?.woz_huidig ?? d.fair_value ?? 0;
  const box3 = berekenBox3({ woz_huidig: woz, hypotheek: box3Hypo, partners: box3Partners });
  const netAfterBox3 = netAnnual - box3.jaarlijkse_heffing;
  const netYBox3 = postRenoVal ? netAfterBox3 / postRenoVal * 100 : 0;

  const cashflow = Array.from({ length: 10 }, (_, i) => ({ year: i+1, cum: -totalInvested + netAnnual*(i+1) }));
  const minCf = Math.min(...cashflow.map(r => r.cum));
  const maxCf = Math.max(...cashflow.map(r => r.cum));
  const range = maxCf - minCf || 1;
  const chartH = 100;

  return (
    <div>
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid rgba(0,60,140,0.12)', marginBottom: 16 }}>
        {[['sell','Verkopen na renovatie'],['rent','Verhuren']].map(([key,label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ padding: '7px 16px', border: 'none', borderBottom: tab===key ? '2px solid #1A56DB' : '2px solid transparent', marginBottom: -2, cursor: 'pointer', fontSize: 12, fontWeight: tab===key ? 700 : 500, background: 'transparent', color: tab===key ? '#1A56DB' : '#3D5570' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'sell' && (
        <>
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ fontSize: 12, color: '#3D5570' }}>Geschatte waarde na renovatie (€)</label>
            <input type="number" value={arv} step={5000} onChange={e => setArv(+e.target.value)} style={{ width: 180, padding: '6px 8px', border: '1px solid rgba(0,60,140,0.15)', borderRadius: 7, fontSize: 13, background: 'rgba(255,255,255,0.70)', color: '#0B1829', outline: 'none' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginBottom: 16 }}>
            {[['Waarde na renovatie',fmt(arv),'blue'],['Totaal geïnvesteerd',fmt(totalInvested),''],['Makelaar & kosten',fmt(agent+costs),''],['Nettowinst',fmt(net),net>0?'green':'red'],['ROI',`${roi.toFixed(1)}%`,roi>0?'green':'red']].map(([l,v,cls]) => (
              <div className="kpi" key={l}><div className="kpi-l">{l}</div><div className={`kpi-v ${cls}`}>{v}</div></div>
            ))}
          </div>
          {net > 0 && (() => {
            const tw = totalAcq+reno+(agent+costs)+net;
            const wa = Math.max(Math.floor(totalAcq/tw*100),2), wr = Math.max(Math.floor(reno/tw*100),2);
            const wc = Math.max(Math.floor((agent+costs)/tw*100),2), wp = Math.max(100-wa-wr-wc,2);
            return (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#6A8AAA', marginBottom: 8 }}>Winstopbouw</div>
                <div className="wf">
                  <div className="ws" style={{ width:`${wa}%`, background:'#1A56DB', color:'#fff' }}>Aankoop</div>
                  <div className="ws" style={{ width:`${wr}%`, background:'#A16207', color:'#fff' }}>Reno.</div>
                  <div className="ws" style={{ width:`${wc}%`, background:'#B91C1C', color:'#fff' }}>Kosten</div>
                  <div className="ws" style={{ width:`${wp}%`, background:'#0A7A4F', color:'#fff' }}>Winst</div>
                </div>
                <div className="wf-leg">
                  {[['#1A56DB','Aankoop',totalAcq],['#A16207','Renovatie',reno],['#B91C1C','Kosten',agent+costs],['#0A7A4F','Winst',net]].map(([bg,lbl,val]) => (
                    <span key={lbl}><span className="wf-dot" style={{ background:bg }}/>{lbl} {fmt(val)}</span>
                  ))}
                </div>
              </div>
            );
          })()}
          {marginOk ? <div className="note note-g">Winst {fmt(net)} ({roi.toFixed(1)}% ROI) overstijgt de gezonde marge.</div>
            : net > 0 ? <div className="note note-y">Winstgevend maar onder gezonde marge.</div>
            : <div className="note note-r">Deal werkt niet. Max. bod: {fmt(arv - healthyMin - reno - (agent+costs))}</div>}
          <div style={{ ...box, marginTop: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#6A8AAA', marginBottom: 12 }}>Maximaal bod voor gewenste ROI</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 12, color: '#3D5570' }}>Gewenste ROI ({desiredRoi}%)</label>
                <input type="range" min={5} max={40} step={1} value={desiredRoi} onChange={e => setDesiredRoi(+e.target.value)} style={{ width: 200, display: 'block', marginTop: 6, accentColor: '#1A56DB' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#6A8AAA', marginBottom: 4 }}>Max. bod</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: maxBid>0?'#1A56DB':'#B91C1C', letterSpacing: -1 }}>{maxBid>0?fmt(maxBid):'Niet haalbaar'}</div>
                {maxBid>0 && <div style={{ fontSize: 11, color: maxBidVsVraag<0?'#0A7A4F':'#A16207', marginTop: 2 }}>{maxBidVsVraag<0?`${fmt(Math.abs(maxBidVsVraag))} onder vraagprijs`:`${fmt(maxBidVsVraag)} boven vraagprijs`}</div>}
              </div>
            </div>
            <div style={{ fontSize: 10, color: '#6A8AAA' }}>Berekening: (ARV × 0,98 ÷ (1 + ROI%)) − renovatie − vaste kosten ÷ 1,115</div>
          </div>
        </>
      )}

      {tab === 'rent' && (
        <>
          {d.huur_methode && <div className="note note-b" style={{ marginBottom: 12, fontSize: 11 }}>Huurschatting via <strong>{d.huur_methode}</strong>.</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: '#3D5570' }}>Maandhuur (€)</label>
              <input type="number" value={monthlyRent} step={50} onChange={e => setMonthlyRent(+e.target.value)} style={inp} />
              <label style={{ fontSize: 12, color: '#3D5570', marginTop: 10, display: 'block' }}>Jaarlijkse kosten (€)</label>
              <input type="number" value={annualExp} step={100} onChange={e => setAnnualExp(+e.target.value)} style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#3D5570' }}>Leegstand ({vacancy}%)</label>
              <input type="range" min={0} max={10} step={0.5} value={vacancy} onChange={e => setVacancy(+e.target.value)} style={{ width: '100%', margin: '6px 0 14px', accentColor: '#1A56DB' }} />
              <label style={{ fontSize: 12, color: '#3D5570' }}>Waardestijging ({appr}%)</label>
              <input type="range" min={0} max={6} step={0.5} value={appr} onChange={e => setAppr(+e.target.value)} style={{ width: '100%', marginTop: 6, accentColor: '#1A56DB' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginBottom: 16 }}>
            {[['Maandhuur',fmt(monthlyRent),'green'],['Bruto rendement',`${grossY.toFixed(1)}%`,'blue'],['Netto rendement',`${netY.toFixed(1)}%`,'blue'],['Cash-on-cash',`${coc.toFixed(1)}%`,'green'],['Terugverdientijd',`${payback} jr`,'']].map(([l,v,cls]) => (
              <div className="kpi" key={l}><div className="kpi-l">{l}</div><div className={`kpi-v ${cls}`}>{v}</div></div>
            ))}
          </div>
          <div style={{ ...box, marginBottom: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#6A8AAA', marginBottom: 12 }}>Box 3 belastingimpact</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label style={{ fontSize: 11, color: '#3D5570' }}>Hypotheek (€)</label><input type="number" value={box3Hypo} step={10000} onChange={e => setBox3Hypo(+e.target.value)} style={inp} /></div>
              <div><label style={{ fontSize: 11, color: '#3D5570' }}>Partners</label><select value={box3Partners} onChange={e => setBox3Partners(+e.target.value)} style={inp}><option value={1}>1</option><option value={2}>2</option></select></div>
              <div className="kad-box"><div className="kad-lbl">Box 3 heffing/jaar</div><div className="kad-val" style={{ color: '#B91C1C' }}>{fmt(box3.jaarlijkse_heffing)}</div><div className="kad-sub">{fmt(box3.maandelijks)}/mnd</div></div>
              <div className="kad-box"><div className="kad-lbl">Netto yield na belasting</div><div className="kad-val" style={{ color: netYBox3>3?'#0A7A4F':'#A16207' }}>{netYBox3.toFixed(1)}%</div><div className="kad-sub">Was {netY.toFixed(1)}%</div></div>
            </div>
            <div className="note note-n" style={{ fontSize: 11 }}>WOZ {fmt(woz)} × {box3.rendement_pct}% × 36% = {fmt(box3.jaarlijkse_heffing)}/jaar</div>
          </div>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#6A8AAA', marginBottom: 8 }}>Cumulatieve cashflow 10 jaar</div>
          <div style={{ ...box, marginBottom: 12 }}>
            <svg width="100%" height={chartH+30} style={{ overflow: 'visible' }}>
              <line x1="0" y1={chartH-((0-minCf)/range)*chartH} x2="100%" y2={chartH-((0-minCf)/range)*chartH} stroke="rgba(0,60,140,0.15)" strokeWidth={1} strokeDasharray="4 4" />
              <polyline points={cashflow.map((r,i) => `${(i/9)*100}%,${chartH-((r.cum-minCf)/range)*chartH}`).join(' ')} fill="none" stroke="#1A56DB" strokeWidth={2} />
              {cashflow.map((r,i) => (
                <g key={i}>
                  <circle cx={`${(i/9)*100}%`} cy={chartH-((r.cum-minCf)/range)*chartH} r={3} fill={r.cum>=0?'#0A7A4F':'#B91C1C'} />
                  <text x={`${(i/9)*100}%`} y={chartH+20} textAnchor="middle" fontSize={9} fill="#6A8AAA">{r.year}</text>
                </g>
              ))}
            </svg>
          </div>
          {payback>0 && <div className="note note-b" style={{ marginBottom: 16 }}>Investering terugverdiend in circa <strong>{payback} jaar</strong> bij {fmt(monthlyRent)}/maand.</div>}
          <div style={{ ...box, marginBottom: 12 }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#6A8AAA', marginBottom: 12 }}>WWS-puntentelling</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
              {[['Buitenruimte (m²)',buitenruimte,setBuiten,0,1],['Aanrecht (cm)',aanrechtCm,setAanrecht,60,30],['Toiletten',toiletten,setToiletten,1,1],['Badkamers',badkamers,setBadkamers,1,1]].map(([l,val,set,min,step]) => (
                <div key={l}><label style={{ fontSize: 11, color: '#3D5570' }}>{l}</label><input type="number" value={val} min={min} step={step} onChange={e => set(+e.target.value)} style={inp} /></div>
              ))}
            </div>
          </div>
          {(() => {
            const wws = berekenWWS({ sqm: d.sqm, energy: d.energy, woz_huidig: d.kadaster?.woz_huidig??0, buitenruimte, aanrecht_cm: aanrechtCm, toiletten, badkamers });
            const barPct = Math.min(Math.round((wws.totaal/250)*100),100);
            const col = wws.categorie==='Vrije sector'?'#0A7A4F':wws.categorie==='Middenhuur'?'#A16207':'#B91C1C';
            const bg  = wws.categorie==='Vrije sector'?'#D1FAE5':wws.categorie==='Middenhuur'?'#FEF3C7':'#FEE2E2';
            return (
              <div style={{ ...box }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#6A8AAA' }}>WWS (indicatief)</div>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 10px', borderRadius: 99, background: bg, color: col, textTransform: 'uppercase', letterSpacing: '.04em' }}>{wws.categorie}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{ flex: 1, height: 5, background: 'rgba(0,60,140,0.12)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${barPct}%`, height: '100%', background: col, borderRadius: 99 }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: col, minWidth: 48 }}>{wws.totaal} pt</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, fontSize: 11, color: '#3D5570' }}>
                  <span>Opp.: +{wws.breakdown.opp_pts} pt</span>
                  <span>Energie: {wws.breakdown.energie_pts>=0?'+':''}{wws.breakdown.energie_pts} pt</span>
                  <span>WOZ: +{wws.breakdown.woz_pts} pt</span>
                </div>
                {wws.max_huur && <div className="note note-y" style={{ marginTop: 10 }}>Max. huur: <strong>€{wws.max_huur.toLocaleString('nl-NL')}/mnd</strong></div>}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
