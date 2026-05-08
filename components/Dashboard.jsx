'use client';
import { useState, useEffect } from 'react';
import { fmt } from '@/lib/utils';
import Overview     from './tabs/Overview';
import Kadaster     from './tabs/Kadaster';
import Potentieel   from './tabs/Potentieel';
import Acquisition  from './tabs/Acquisition';
import Renovation   from './tabs/Renovation';
import ExitStrategy from './tabs/ExitStrategy';

const TABS       = ['Overzicht', 'Kadaster', 'Potentieel', 'Aankoop', 'Renovatie', 'Exitstrategie'];
const STEPS      = ['Pagina ophalen', 'Woninggegevens extraheren', 'Kadaster PDOK raadplegen', 'Vergelijkbare verkopen analyseren', 'Investeringsmodel bouwen'];
const STEPS_ADDR = ['Funda doorzoeken op adres', 'Listing gevonden — pagina ophalen', 'Kadaster PDOK raadplegen', 'Vergelijkbare verkopen analyseren', 'Investeringsmodel bouwen'];

// ── Hulpfuncties ──────────────────────────────────────────────────────────────

// ── Component ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [url,       setUrl]       = useState('');
  const [loading,   setLoading]   = useState(false);
  const [step,      setStep]      = useState(0);
  const [activeSteps, setActiveSteps] = useState(STEPS);
  const [data,      setData]      = useState(null);
  const [error,     setError]     = useState(null);
  const [saved,     setSaved]     = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [totalAcq,  setTotalAcq]  = useState(null);
  const [renoState, setRenoState] = useState(null);

  useEffect(() => {
    try { setSaved(JSON.parse(localStorage.getItem('saved_properties') ?? '[]')); } catch {}
  }, []);

  function isUrl(input) {
    return /^https?:\/\//i.test(input.trim());
  }

  // ── URL-caching (24u TTL, max 30 entries) ─────────────────────────────────
  const CACHE_TTL = 24 * 60 * 60 * 1000;
  function getCached(key) {
    try {
      const c = JSON.parse(localStorage.getItem('url_cache') ?? '{}');
      const e = c[key];
      return e && Date.now() - e.ts < CACHE_TTL ? e.data : null;
    } catch { return null; }
  }
  function setCached(key, d) {
    try {
      const c = JSON.parse(localStorage.getItem('url_cache') ?? '{}');
      c[key] = { data: d, ts: Date.now() };
      const keys = Object.keys(c);
      if (keys.length > 30) delete c[keys[0]];
      localStorage.setItem('url_cache', JSON.stringify(c));
    } catch {}
  }

  // ── Analyse ───────────────────────────────────────────────────────────────
  async function analyze() {
    if (!url) return;
    const trimmed = url.trim();

    // Cache check
    const cached = getCached(trimmed);
    if (cached) {
      setData(cached);
      setTotalAcq(cached.price * 1.115);
      setRenoState({ reno: cached.reno_cost, uplift: cached.reno_cost * 0.7, healthyMin: (cached.price * 1.115 + cached.reno_cost) * (cached.healthy_margin / 100) });
      setActiveTab(0);
      return;
    }

    setLoading(true);
    setError(null);
    setStep(0);

    const isAddress = !isUrl(trimmed);
    const endpoint  = isAddress ? '/api/address' : '/api/analyze';
    const body      = isAddress ? { address: trimmed } : { url: trimmed };
    setActiveSteps(isAddress ? STEPS_ADDR : STEPS);

    const ticker = setInterval(() => setStep(s => Math.min(s + 1, STEPS.length - 1)), 700);
    try {
      const res  = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      clearInterval(ticker);
      setData(json);
      setCached(trimmed, json);
      setTotalAcq(json.price * 1.115);
      setRenoState({ reno: json.reno_cost, uplift: json.reno_cost * 0.7, healthyMin: (json.price * 1.115 + json.reno_cost) * (json.healthy_margin / 100) });
      setActiveTab(0);
    } catch (e) {
      clearInterval(ticker);
      setError(e.message);
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

  const sc      = data?.investment_score ?? 5;
  const scCol   = sc >= 7 ? '#15803D' : sc >= 5 ? '#B45309' : '#B91C1C';
  const scLabel = sc >= 7 ? 'Sterke koop' : sc >= 5 ? 'Voorwaardelijk' : 'Vermijden';
  const energy  = data?.energy ?? 'C';
  const kad     = data?.kadaster ?? {};
  const acq     = totalAcq ?? (data?.price ?? 0) * 1.115;
  const reno    = renoState?.reno      ?? data?.reno_cost ?? 0;
  const uplift  = renoState?.uplift    ?? reno * 0.7;
  const hMin    = renoState?.healthyMin ?? (acq + reno) * ((data?.healthy_margin ?? 15) / 100);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{ width: 224, background: 'rgba(6,12,24,0.88)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRight: '1px solid rgba(43,127,255,0.12)', padding: '22px 14px', flexShrink: 0, position: 'fixed', top: 0, left: 0, height: '100vh', overflowY: 'auto' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 18 }}>
          <div style={{ width: 30, height: 30, background: '#1A56DB', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 12L6 7L9 10L13 4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div>
            <div className="logo">VastgoedAI</div>
            <div className="logo-sub">Investment Platform</div>
          </div>
        </div>

        <div className="sb-div" />

        {/* Input */}
        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: '#3D5570', marginBottom: 6 }}>Analyse</div>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && analyze()}
          placeholder="URL of adres…"
          style={{ width: '100%', padding: '8px 10px', background: '#132135', border: '1px solid #1C3150', borderRadius: 7, color: '#CBD5E1', fontSize: 12, marginBottom: 6, outline: 'none', fontFamily: 'Inter, sans-serif' }}
        />
        <button
          onClick={analyze}
          disabled={loading}
          style={{ width: '100%', padding: '9px 12px', background: '#1A56DB', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .6 : 1, letterSpacing: '.01em' }}>
          {loading ? 'Analyseren…' : 'Woning analyseren →'}
        </button>
        {error && (
          <div style={{ marginTop: 8, padding: '8px 10px', background: '#3F1212', border: '1px solid #7F1D1D', borderRadius: 7, fontSize: 11, color: '#FCA5A5', lineHeight: 1.5 }}>
            {error}
          </div>
        )}

        {saved.length > 0 && (
          <>
            <div className="sb-div" />
            <div className="sb-section">Opgeslagen woningen</div>
            {saved.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                <button
                  onClick={() => {
                    setData(p);
                    setActiveTab(0);
                    setTotalAcq(p.price * 1.115);
                    setRenoState({ reno: p.reno_cost, uplift: p.reno_cost * 0.7, healthyMin: (p.price * 1.115 + p.reno_cost) * (p.healthy_margin / 100) });
                  }}
                  style={{ flex: 1, textAlign: 'left', padding: '8px 10px', background: '#132135', border: '1px solid #1C3150', borderRadius: 7, color: '#94A3B8', fontSize: 11, cursor: 'pointer', lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 600, color: '#CBD5E1', fontSize: 11 }}>{(p.address ?? '').slice(0, 24)}</div>
                  <div style={{ color: '#4A6080', fontSize: 10, marginTop: 1 }}>{fmt(p.price)}</div>
                </button>
                <button onClick={() => removeProperty(i)} style={{ padding: '4px 7px', background: '#132135', border: '1px solid #1C3150', borderRadius: 7, color: '#3D5570', fontSize: 11, cursor: 'pointer' }}>✕</button>
              </div>
            ))}
          </>
        )}

        <div style={{ position: 'absolute', bottom: 16, left: 14, right: 14 }}>
          <div style={{ fontSize: 9, color: '#253D57', textAlign: 'center', lineHeight: 1.6 }}>PDOK · Kadaster · Claude AI</div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ marginLeft: 224, flex: 1, padding: '24px 28px', minWidth: 0 }}>
        {loading && (
          <div style={{ padding: '80px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.14em', color: '#7A8FA6' }}>Analyse bezig</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#0B1829', letterSpacing: '-.3px' }}>Woning verwerken</div>
            <div style={{ fontSize: 11, color: '#6A8AAA', maxWidth: 380, textAlign: 'center', wordBreak: 'break-all' }}>{url.slice(0, 70)}{url.length > 70 ? '…' : ''}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 400 }}>
              {activeSteps.map((s, j) => {
                const cls = j < step ? 'ok' : j === step ? 'on' : '';
                const ic  = j < step ? '✓' : j === step ? '→' : '·';
                return <div key={j} className={`ls ${cls}`}><div className={`ld ${cls}`} />{ic} {s}</div>;
              })}
            </div>
            <div style={{ width: 400, height: 3, background: '#DDE3ED', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#1A56DB', borderRadius: 3, width: `${(step + 1) / activeSteps.length * 100}%`, transition: 'width .5s ease' }} />
            </div>
          </div>
        )}

        {!loading && !data && (
          <>
            <div className="hero"><div className="hero-img" /><div className="hero-content"><div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.18em', color: '#2B7FFF', marginBottom: 10 }}>Vastgoed Investment Platform</div><div className="hero-title">Investeringsanalyse<br />in seconden.</div><div className="hero-desc">Plak een woninglink of typ een adres voor een compleet investeringsdossier — Kadasterdata, risicoscore, vergelijkbare verkopen en exitstrategie.</div></div></div>
            <div className="feat-row">
              {[['Woningdata','Prijs, m², energielabel en staat automatisch opgehaald uit elke listing.'],['Kadaster BAG','Officiële splitsingstatus, oppervlakte, bouwjaar en gebruik via PDOK API.'],['Risicoanalyse','Locatie-, staat-, markt- en liquiditeitsrisico met een totaalscore.'],['Exitstrategie','Volledig verkoop- of verhuur-ROI met gezonde marge en terugverdientijd.']].map(([name, txt]) => (
                <div className="feat" key={name}><div className="feat-name">{name}</div><div className="feat-txt">{txt}</div></div>
              ))}
            </div>
            <div className="pill-row">
              {[['Werkt met','Funda · Pararius · Vendr · meer'],['Kadasterbron','PDOK BAG — Officieel Nederlands register'],['Aangedreven door','Claude AI (Anthropic)']].map(([lbl, val]) => (
                <div className="pill" key={lbl}><div><div className="pill-lbl">{lbl}</div><div className="pill-val">{val}</div></div></div>
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
                  {data.url && isUrl(data.url) && <>&nbsp;&nbsp;<a href={data.url} target="_blank" rel="noreferrer">Bekijk listing ↗</a></>}
                  {kad.bag_viewer_url && <>&nbsp;·&nbsp;<a href={kad.bag_viewer_url} target="_blank" rel="noreferrer">Open in Kadaster ↗</a></>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={() => window.print()} style={{ padding: '8px 16px', background: '#fff', color: '#1C1C1E', border: '1px solid #E4E4E7', borderRadius: 9, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>PDF exporteren</button>
                <button onClick={saveProperty} style={{ padding: '8px 16px', background: '#1C1C1E', color: '#FAFAFA', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Opslaan</button>
                <div className="score-wrap">
                  <div style={{ fontSize: 9, color: '#6A8AAA', textTransform: 'uppercase', letterSpacing: '.1em' }}>Score</div>
                  <div className="score-num" style={{ color: scCol }}>{sc}<span style={{ fontSize: 14, color: '#6A8AAA', fontWeight: 400 }}>/10</span></div>
                  <div className="score-lbl" style={{ color: scCol }}>{scLabel}</div>
                </div>
              </div>
            </div>

            {/* KPI strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8, marginBottom: 14 }}>
              {[
                ['Vraagprijs',   fmt(data.price),            fmt(Math.floor(data.price / Math.max(data.sqm, 1))) + '/m²',                                                           'blue'],
                ['Marktwaarde',  fmt(data.fair_value),       data.fair_value > data.price ? 'Boven vraagprijs' : 'Onder vraagprijs',                                                data.fair_value > data.price ? 'green' : 'amber'],
                ['Renovatie',    fmt(data.reno_cost),        'Waardestijging ≈ +' + fmt(data.reno_cost * 0.7),                                                                      'amber'],
                ['Markthuur',    fmt(data.monthly_rent) + '/mnd', 'Rendement ' + (data.monthly_rent * 12 / Math.max(data.fair_value + data.reno_cost * 0.7, 1) * 100).toFixed(1) + '%', 'green'],
                ['Risicoscore',  data.risk_score + '/10',   data.risk_score <= 3 ? 'Laag' : data.risk_score <= 6 ? 'Gemiddeld' : 'Hoog risico',                                   data.risk_score <= 3 ? 'green' : data.risk_score <= 6 ? 'amber' : 'red'],
                ['Min. marge',   data.healthy_margin + '%', 'Min. ' + fmt((data.price + data.reno_cost) * data.healthy_margin / 100),                                               'purple'],
              ].map(([lbl, val, hint, cls]) => (
                <div className="kpi" key={lbl}><div className="kpi-l">{lbl}</div><div className={`kpi-v ${cls}`}>{val}</div><div className="kpi-s">{hint}</div></div>
              ))}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #DDE3ED', marginBottom: 16 }}>
              {TABS.map((t, i) => (
                <button key={i} onClick={() => setActiveTab(i)} style={{ padding: '8px 16px', border: 'none', borderBottom: activeTab === i ? '2px solid #1A56DB' : '2px solid transparent', marginBottom: -2, cursor: 'pointer', fontSize: 12, fontWeight: activeTab === i ? 700 : 500, background: 'transparent', color: activeTab === i ? '#1A56DB' : '#7A8FA6', letterSpacing: '.01em', transition: 'color .15s' }}>
                  {t}
                </button>
              ))}
            </div>

            {activeTab === 0 && <Overview     d={data} />}
            {activeTab === 1 && <Kadaster     d={data} />}
            {activeTab === 2 && <Potentieel   d={data} />}
            {activeTab === 3 && <Acquisition  d={data} onUpdate={setTotalAcq} />}
            {activeTab === 4 && <Renovation   d={data} totalAcq={acq} onUpdate={setRenoState} />}
            {activeTab === 5 && <ExitStrategy d={data} totalAcq={acq} reno={reno} uplift={uplift} healthyMin={hMin} />}
          </>
        )}

        <div style={{ textAlign: 'center', fontSize: 10, color: '#6A8AAA', padding: '20px 0 8px', borderTop: '1px solid #DDE3ED', marginTop: 8 }}>
          VastgoedAI · PDOK Kadaster BAG · Claude AI (Anthropic) · {new Date().getFullYear()}
        </div>
      </main>
    </div>
  );
}
