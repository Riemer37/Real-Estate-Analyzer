'use client';
import { useState, useEffect } from 'react';
import { fmt } from '@/lib/utils';
import Overview     from './tabs/Overview';
import Kadaster     from './tabs/Kadaster';
import Acquisition  from './tabs/Acquisition';
import Renovation   from './tabs/Renovation';
import ExitStrategy from './tabs/ExitStrategy';

const TABS = ['📋 Overzicht', '🗂️ Kadaster', '🔑 Aankoop', '🔨 Renovatie', '📈 Exitstrategie'];
const STEPS = ['Pagina ophalen', 'Woninggegevens extraheren', 'Kadaster PDOK raadplegen', 'Vergelijkbare verkopen analyseren', 'Investeringsmodel bouwen'];

export default function Dashboard() {
  const [url,      setUrl]      = useState('');
  const [loading,  setLoading]  = useState(false);
  const [step,     setStep]     = useState(0);
  const [data,     setData]     = useState(null);
  const [saved,    setSaved]    = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [totalAcq, setTotalAcq] = useState(null);
  const [renoState, setRenoState] = useState(null);

  useEffect(() => {
    try { setSaved(JSON.parse(localStorage.getItem('saved_properties') ?? '[]')); } catch {}
  }, []);

  async function analyze() {
    if (!url) return;
    setLoading(true);
    setStep(0);

    const ticker = setInterval(() => setStep(s => Math.min(s + 1, STEPS.length - 1)), 700);
    try {
      const res  = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
      const json = await res.json();
      clearInterval(ticker);
      setData(json);
      setTotalAcq(json.price * 1.115);
      setRenoState({ reno: json.reno_cost, uplift: json.reno_cost * 0.7, healthyMin: (json.price * 1.115 + json.reno_cost) * (json.healthy_margin / 100) });
      setActiveTab(0);
    } catch (e) {
      clearInterval(ticker);
      alert('Error: ' + e.message);
    }
    setLoading(false);
  }

  function saveProperty() {
    if (!data) return;
    const list = JSON.parse(localStorage.getItem('saved_properties') ?? '[]');
    if (!list.find(p => p.url === data.url)) {
      list.push(data);
      localStorage.setItem('saved_properties', JSON.stringify(list));
      setSaved(list);
    }
  }

  function removeProperty(i) {
    const list = [...saved];
    list.splice(i, 1);
    localStorage.setItem('saved_properties', JSON.stringify(list));
    setSaved(list);
  }

  const sc       = data?.investment_score ?? 5;
  const scCol    = sc >= 7 ? '#15803D' : sc >= 5 ? '#B45309' : '#B91C1C';
  const scLabel  = sc >= 7 ? 'Sterke koop' : sc >= 5 ? 'Voorwaardelijk' : 'Vermijden';
  const energy   = data?.energy ?? 'C';
  const kad      = data?.kadaster ?? {};
  const acq      = totalAcq ?? (data?.price ?? 0) * 1.115;
  const reno     = renoState?.reno     ?? data?.reno_cost ?? 0;
  const uplift   = renoState?.uplift   ?? reno * 0.7;
  const hMin     = renoState?.healthyMin ?? (acq + reno) * ((data?.healthy_margin ?? 15) / 100);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{ width: 220, background: '#18181B', borderRight: '1px solid #27272A', padding: '24px 16px', flexShrink: 0, position: 'fixed', top: 0, left: 0, height: '100vh', overflowY: 'auto' }}>
        <div className="logo">Vastgoed</div>
        <div className="logo-sub">Investment Platform</div>
        <div className="sb-div" />
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && analyze()}
          placeholder="Plak listing URL…"
          style={{ width: '100%', padding: '8px 10px', background: '#27272A', border: '1px solid #3F3F46', borderRadius: 8, color: '#F4F4F5', fontSize: 12, marginBottom: 8, outline: 'none' }}
        />
        <button onClick={analyze} style={{ width: '100%', padding: '8px 12px', background: '#27272A', border: '1px solid #3F3F46', borderRadius: 8, color: '#F4F4F5', fontSize: 12, cursor: 'pointer' }}>
          Woning analyseren →
        </button>
        {saved.length > 0 && (
          <>
            <div className="sb-div" />
            <div className="sb-section">Opgeslagen woningen</div>
            {saved.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                <button onClick={() => { setData(p); setActiveTab(0); setTotalAcq(p.price * 1.115); setRenoState({ reno: p.reno_cost, uplift: p.reno_cost * 0.7, healthyMin: (p.price * 1.115 + p.reno_cost) * (p.healthy_margin / 100) }); }}
                  style={{ flex: 1, textAlign: 'left', padding: '8px 10px', background: '#27272A', border: '1px solid #3F3F46', borderRadius: 8, color: '#A1A1AA', fontSize: 11, cursor: 'pointer', lineHeight: 1.4 }}>
                  {p.address.slice(0, 22)}…<br />{fmt(p.price)}
                </button>
                <button onClick={() => removeProperty(i)} style={{ padding: '4px 7px', background: '#27272A', border: '1px solid #3F3F46', borderRadius: 8, color: '#71717A', fontSize: 11, cursor: 'pointer' }}>✕</button>
              </div>
            ))}
          </>
        )}
      </aside>

      {/* Main */}
      <main style={{ marginLeft: 220, flex: 1, padding: 28, minWidth: 0 }}>
        {loading && (
          <div style={{ padding: '80px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
            <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 24, color: '#1C1C1E' }}>Woning analyseren</div>
            <div style={{ fontSize: 11, color: '#A1A1AA', maxWidth: 380, textAlign: 'center', wordBreak: 'break-all' }}>{url.slice(0, 70)}{url.length > 70 ? '…' : ''}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, width: 380 }}>
              {STEPS.map((s, j) => {
                const cls = j < step ? 'ok' : j === step ? 'on' : '';
                const ic  = j < step ? '✓' : j === step ? '→' : '·';
                return <div key={j} className={`ls ${cls}`}><div className={`ld ${cls}`} />{ic} {s}</div>;
              })}
            </div>
            <div style={{ width: 380, height: 2, background: '#E4E4E7', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#1C1C1E', borderRadius: 2, width: `${(step + 1) / STEPS.length * 100}%`, transition: 'width .5s ease' }} />
            </div>
          </div>
        )}

        {!loading && !data && (
          <>
            <div className="hero"><div className="hero-img" /><div className="hero-content"><div className="hero-title">Vastgoedinvestering,<br />analytisch gemaakt.</div><div className="hero-desc">Plak een Nederlandse woninglink voor een compleet investeringsdossier — Kadasterdata, risicoscore, vergelijkbare verkopen en exitstrategie.</div></div></div>
            <div className="feat-row">
              {[['🏠','Woningdata','Prijs, m², energielabel en staat automatisch opgehaald uit elke listing.'],['🗂️','Kadaster BAG','Officiële splitsingstatus, oppervlakte, bouwjaar en gebruik via PDOK API.'],['⚠️','Risicoanalyse','Locatie-, staat-, markt- en liquiditeitsrisico met een totaalscore.'],['📈','Exitstrategie','Volledig verkoop- of verhuur-ROI met gezonde marge en terugverdientijd.']].map(([ico,name,txt]) => (
                <div className="feat" key={name}><div className="feat-ico">{ico}</div><div className="feat-name">{name}</div><div className="feat-txt">{txt}</div></div>
              ))}
            </div>
            <div className="pill-row">
              {[['🏗️','Werkt met','Funda · Pararius · Vendr · meer'],['🗺️','Kadasterbron','PDOK BAG — Officieel Nederlands register'],['🤖','Aangedreven door','Claude AI (Anthropic)']].map(([ico,lbl,val]) => (
                <div className="pill" key={lbl}><div className="pill-ico">{ico}</div><div><div className="pill-lbl">{lbl}</div><div className="pill-val">{val}</div></div></div>
              ))}
            </div>
          </>
        )}

        {!loading && data && (
          <>
            {/* Property header */}
            <div className="prop-bar">
              <div>
                <div className="prop-title">{data.address}</div>
                <div className="prop-meta">
                  {data.property_type} &nbsp;·&nbsp; {data.sqm} m² &nbsp;·&nbsp; {data.rooms} kamers &nbsp;·&nbsp; Gebouwd {data.year} &nbsp;·&nbsp; <span className={`eb eb-${energy}`}>{energy}</span>
                  &nbsp;&nbsp;<a href={data.url} target="_blank" rel="noreferrer">Bekijk listing ↗</a>
                  {kad.bag_viewer_url && <>&nbsp;·&nbsp;<a href={kad.bag_viewer_url} target="_blank" rel="noreferrer">Open in Kadaster ↗</a></>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={saveProperty} style={{ padding: '8px 16px', background: '#1C1C1E', color: '#FAFAFA', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>💾 Opslaan</button>
                <div className="score-wrap">
                  <div style={{ fontSize: 9, color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '.1em' }}>Score</div>
                  <div className="score-num" style={{ color: scCol }}>{sc}<span style={{ fontSize: 14, color: '#C0BDB8', fontWeight: 400 }}>/10</span></div>
                  <div className="score-lbl" style={{ color: scCol }}>{scLabel}</div>
                </div>
              </div>
            </div>

            {/* KPI strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, marginBottom: 14 }}>
              {[
                ['Vraagprijs',     fmt(data.price),              fmt(Math.floor(data.price / Math.max(data.sqm,1))) + '/m²',                                                              'blue'],
                ['Marktwaarde',   fmt(data.fair_value),         data.fair_value > data.price ? 'Boven vraagprijs' : 'Onder vraagprijs',                                                   data.fair_value > data.price ? 'green' : 'amber'],
                ['Renovatie',     fmt(data.reno_cost),          'Waardestijging ≈ +' + fmt(data.reno_cost * 0.7),                                                                         'amber'],
                ['Markthuur',     fmt(data.monthly_rent) + '/mnd', 'Rendement ' + (data.monthly_rent * 12 / (data.fair_value + data.reno_cost * 0.7) * 100).toFixed(1) + '%',            'green'],
                ['Risicoscore',   data.risk_score + '/10',      data.risk_score <= 3 ? 'Laag' : data.risk_score <= 6 ? 'Gemiddeld' : 'Hoog risico',                                      data.risk_score <= 3 ? 'green' : data.risk_score <= 6 ? 'amber' : 'red'],
                ['Min. marge',    data.healthy_margin + '%',    'Min. ' + fmt((data.price + data.reno_cost) * data.healthy_margin / 100),                                                 'purple'],
              ].map(([lbl, val, hint, cls]) => (
                <div className="kpi" key={lbl}><div className="kpi-l">{lbl}</div><div className={`kpi-v ${cls}`}>{val}</div><div className="kpi-s">{hint}</div></div>
              ))}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, background: '#F4F4F5', borderRadius: 10, padding: 4, marginBottom: 16, width: 'fit-content' }}>
              {TABS.map((t, i) => (
                <button key={i} onClick={() => setActiveTab(i)} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, background: activeTab === i ? '#fff' : 'transparent', color: activeTab === i ? '#1C1C1E' : '#71717A', boxShadow: activeTab === i ? '0 1px 3px rgba(0,0,0,.08)' : 'none' }}>
                  {t}
                </button>
              ))}
            </div>

            {activeTab === 0 && <Overview d={data} />}
            {activeTab === 1 && <Kadaster d={data} />}
            {activeTab === 2 && <Acquisition d={data} onUpdate={setTotalAcq} />}
            {activeTab === 3 && <Renovation d={data} totalAcq={acq} onUpdate={setRenoState} />}
            {activeTab === 4 && <ExitStrategy d={data} totalAcq={acq} reno={reno} uplift={uplift} healthyMin={hMin} />}
          </>
        )}

        <div style={{ textAlign: 'center', fontSize: 11, color: '#C0BDB8', padding: '24px 0 8px' }}>
          Vastgoed Investment Platform · PDOK Kadaster BAG · Claude AI · {new Date().getFullYear()}
        </div>
      </main>
    </div>
  );
}
