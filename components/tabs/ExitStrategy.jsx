'use client';
import { useState } from 'react';
import { fmt } from '@/lib/utils';
import { berekenWWS, WWS_SOCIAAL_GRENS, WWS_MIDDEN_GRENS } from '@/lib/wws';
import { berekenBox3 } from '@/lib/box3'; // NIEUW

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
  // NIEUW: max bod calculator
  const [desiredRoi,   setDesiredRoi]  = useState(15);
  // NIEUW: Box 3 inputs
  const [box3Hypo,     setBox3Hypo]    = useState(0);
  const [box3Partners, setBox3Partners] = useState(1);

  // Sell
  const agent    = arv * 0.015;
  const costs    = arv * 0.005;
  const net      = arv - totalInvested - agent - costs;
  const roi      = totalInvested ? net / totalInvested * 100 : 0;
  const marginOk = net >= healthyMin;

  // NIEUW: Max bod berekening (omgekeerde ROI)
  // totalInvested_max = arv * 0.98 / (1 + desiredRoi/100)
  // bid_max = (totalInvested_max - reno - fixedCosts) / 1.115
  const fixedAcqCosts  = 5100; // notaris + taxatie + keuring + overig (standaard)
  const totalInvMax    = arv * 0.98 / (1 + desiredRoi / 100);
  const maxBid         = Math.round((totalInvMax - reno - fixedAcqCosts) / 1.115);
  const maxBidVsVraag  = maxBid - d.price;

  // Rent
  const effRent   = monthlyRent * 12 * (1 - vacancy / 100);
  const netAnnual = effRent - annualExp;
  const grossY    = postRenoVal ? monthlyRent * 12 / postRenoVal * 100 : 0;
  const netY      = postRenoVal ? netAnnual / postRenoVal * 100 : 0;
  const coc       = totalInvested ? netAnnual / totalInvested * 100 : 0;
  const payback   = netAnnual > 0 ? Math.floor(totalInvested / netAnnual) : 0;

  // NIEUW: Box 3 belasting (verhuurscenario)
  const woz      = d.kadaster?.woz_huidig ?? d.fair_value ?? 0;
  const box3     = berekenBox3({ woz_huidig: woz, hypotheek: box3Hypo, partners: box3Partners });
  const netAfterBox3 = netAnnual - box3.jaarlijkse_heffing;
  const netYBox3     = postRenoVal ? netAfterBox3 / postRenoVal * 100 : 0;

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
              <div style={{ marginTop: 4, marginBottom: 16 }}>
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
            ? <div className="note note-g">Winst {fmt(net)} ({roi.toFixed(1)}% ROI) overstijgt de gezonde marge van {fmt(healthyMin)} ({d.healthy_margin}%)</div>
            : net > 0
              ? <div className="note note-y">Winstgevend maar onder de gezonde marge — verlaag bod of renovatieomvang.</div>
              : <div className="note note-r">Deal werkt niet bij deze parameters. Maximaal haalbaar bod: {fmt(arv - healthyMin - reno - (agent + costs))}</div>
          }

          {/* NIEUW: Max bod calculator */}
          <div style={{ background: '#FAFAF8', border: '1px solid #E4E4E7', borderRadius: 12, padding: '16px 20px', marginTop: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#C0BDB8', marginBottom: 12 }}>Maximaal bod voor gewenste ROI</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: '#71717A' }}>Gewenste ROI ({desiredRoi}%)</label>
                <input type="range" min={5} max={40} step={1} value={desiredRoi} onChange={e => setDesiredRoi(+e.target.value)} style={{ width: 200, display: 'block', marginTop: 6 }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#C0BDB8', marginBottom: 4 }}>Max. bod</div>
                <div style={{ fontSize: 28, fontWeight: 600, color: maxBid > 0 ? '#1D4ED8' : '#B91C1C', letterSpacing: -1 }}>{maxBid > 0 ? fmt(maxBid) : 'Niet haalbaar'}</div>
                {maxBid > 0 && (
                  <div style={{ fontSize: 11, color: maxBidVsVraag < 0 ? '#15803D' : '#B45309', marginTop: 2 }}>
                    {maxBidVsVraag < 0 ? `${fmt(Math.abs(maxBidVsVraag))} onder vraagprijs — onderhandelruimte aanwezig` : `${fmt(maxBidVsVraag)} boven vraagprijs — deal werkt op basis van ARV`}
                  </div>
                )}
              </div>
            </div>
            <div style={{ fontSize: 10, color: '#A1A1AA' }}>
              Berekening: (ARV × 0,98 ÷ (1 + ROI%)) − renovatie − vaste kosten (€{fixedAcqCosts.toLocaleString('nl-NL')}) ÷ 1,115 (incl. 10,4% OVB)
            </div>
          </div>
        </>
      )}

      {tab === 'rent' && (
        <>
          {d.huur_methode && (
            <div className="note note-b" style={{ marginBottom: 12, fontSize: 11 }}>
              Huurschatting berekend via <strong>{d.huur_methode}</strong> — pas aan indien afwijkt van markt.
            </div>
          )}
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

          {/* NIEUW: Box 3 impact op verhuurrendement */}
          <div style={{ background: '#FAFAF8', border: '1px solid #E4E4E7', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#C0BDB8', marginBottom: 12 }}>Box 3 belastingimpact op verhuurrendement</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: '#71717A' }}>Hypotheek (€)</label>
                <input type="number" value={box3Hypo} step={10000} onChange={e => setBox3Hypo(+e.target.value)} style={{ width: '100%', padding: '5px 8px', border: '1px solid #E4E4E7', borderRadius: 6, fontSize: 12, marginTop: 3 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#71717A' }}>Fiscaal partners</label>
                <select value={box3Partners} onChange={e => setBox3Partners(+e.target.value)} style={{ width: '100%', padding: '6px 8px', border: '1px solid #E4E4E7', borderRadius: 6, fontSize: 12, marginTop: 3, background: '#fff' }}>
                  <option value={1}>1 persoon</option>
                  <option value={2}>2 partners</option>
                </select>
              </div>
              <div className="kad-box">
                <div className="kad-lbl">Box 3 heffing/jaar</div>
                <div className="kad-val" style={{ color: '#B91C1C' }}>{fmt(box3.jaarlijkse_heffing)}</div>
                <div className="kad-sub">{fmt(box3.maandelijks)}/mnd</div>
              </div>
              <div className="kad-box">
                <div className="kad-lbl">Netto yield na belasting</div>
                <div className="kad-val" style={{ color: netYBox3 > 3 ? '#15803D' : '#B45309' }}>{netYBox3.toFixed(1)}%</div>
                <div className="kad-sub">Was {netY.toFixed(1)}% voor Box 3</div>
              </div>
            </div>
            <div className="note note-n" style={{ fontSize: 11 }}>
              WOZ {fmt(woz)} × {box3.rendement_pct}% fictief rendement × 36% = {fmt(box3.jaarlijkse_heffing)}/jaar · {box3.methode}
            </div>
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
              {[['Buitenruimte (m²)', buitenruimte, setBuiten, 0, 1], ['Aanrecht (cm)', aanrechtCm, setAanrecht, 60, 30], ['Toiletten', toiletten, setToiletten, 1, 1], ['Badkamers', badkamers, setBadkamers, 1, 1]].map(([lbl, val, set, min, step]) => (
                <div key={lbl}>
                  <label style={{ fontSize: 11, color: '#71717A' }}>{lbl}</label>
                  <input type="number" value={val} min={min} step={step} onChange={e => set(+e.target.value)} style={{ width: '100%', padding: '5px 8px', border: '1px solid #E4E4E7', borderRadius: 6, fontSize: 12, marginTop: 3 }} />
                </div>
              ))}
            </div>
          </div>

          {/* WWS puntentelling */}
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
