'use client';
import { useState, useEffect } from 'react';
import { fmt } from '@/lib/utils';
import { berekenRenovatiekosten } from '@/lib/reno';
import { berekenRisico }          from '@/lib/risico';
import { berekenWWS }             from '@/lib/wws';
import Overview     from './tabs/Overview';
import Kadaster     from './tabs/Kadaster';
import Potentieel   from './tabs/Potentieel';
import Acquisition  from './tabs/Acquisition';
import Renovation   from './tabs/Renovation';
import ExitStrategy from './tabs/ExitStrategy';

const TABS  = ['Overzicht', 'Kadaster', 'Potentieel', 'Aankoop', 'Renovatie', 'Exitstrategie'];
const STEPS = ['Pagina ophalen', 'AI analyse uitvoeren', 'Kadaster & PDOK raadplegen'];

// ── Hulpfuncties ──────────────────────────────────────────────────────────────

function getMedianPricePerM2(koopsommen) {
  const valid = (koopsommen ?? [])
    .filter(k => k.prijs && k.opp && k.opp > 20)
    .map(k => k.prijs / k.opp);
  if (!valid.length) return 0;
  valid.sort((a, b) => a - b);
  return valid[Math.floor(valid.length / 2)];
}

function buildResult({ url, d, kad, structured }) {
  const price         = parseInt(d.PRICE)       || structured?.price   || 0;
  const sqm           = kad?.official_sqm       || parseInt(d.SQM)     || structured?.sqm    || 85;
  const year          = kad?.official_year      || parseInt(d.YEAR)    || structured?.year   || 1970;
  const energy        = kad?.energy_label       || d.ENERGY            || structured?.energy || 'C';
  const condition     = d.CONDITION             || 'Fair';
  const property_type = d.PROPERTY_TYPE         || 'House';
  const rooms         = parseInt(d.ROOMS)       || structured?.rooms   || 0;
  const address       = kad?.official_address   || d.ADDRESS           || structured?.address || url;
  const erfpacht      = d.ERFPACHT              || structured?.erfpacht|| 'Onbekend';
  const inv_score     = parseInt(d.INVESTMENT_SCORE) || 5;
  const h_margin      = parseInt(d.HEALTHY_MARGIN)   || 15;

  // Marktwaarde: mediaan koopsommen → WOZ → vraagprijs
  let fair_value = 0;
  if (kad?.koopsommen?.length > 0 && sqm > 0) {
    const med = getMedianPricePerM2(kad.koopsommen);
    if (med > 0) fair_value = Math.round(med * sqm);
  }
  if (!fair_value && kad?.woz_huidig) fair_value = kad.woz_huidig;
  if (!fair_value && price)           fair_value = price;

  // Renovatiekosten (factbased)
  const { kosten: reno_cost, items: reno_items } =
    berekenRenovatiekosten({ sqm, condition, year, property_type, energy });

  // Risicoscore (factbased)
  const risicoResult = berekenRisico({
    price, fair_value,
    woz_huidig:  kad?.woz_huidig  || 0,
    year, energy, condition, property_type, sqm,
    erfpacht,
  });

  // Huurwaarde: WOZ×5%/12, gecapt door WWS max_huur
  const wwsResult  = berekenWWS({ sqm, energy, woz_huidig: kad?.woz_huidig || 0 });
  const woz_rent   = kad?.woz_huidig ? Math.round(kad.woz_huidig * 0.05 / 12) : 0;
  let monthly_rent = woz_rent;
  let huur_methode = 'WOZ×5%/12';
  if (wwsResult.max_huur && woz_rent > wwsResult.max_huur) {
    monthly_rent = wwsResult.max_huur;
    huur_methode = `WWS max (${wwsResult.categorie})`;
  }

  // Vergelijkbare verkopen (van AI)
  const comps = [1, 2, 3].map(i => ({
    address: d[`COMP${i}_ADDRESS`] || null,
    price:   parseInt(d[`COMP${i}_PRICE`]) || null,
    sqm:     parseInt(d[`COMP${i}_SQM`])  || null,
    year:    d[`COMP${i}_YEAR`]            || null,
  })).filter(c => c.address);

  return {
    url,
    address,
    price,
    sqm,
    year,
    energy,
    condition,
    property_type,
    rooms,
    erfpacht,
    erfpacht_canon:    parseInt(d.ERFPACHT_CANON) || 0,
    investment_score:  inv_score,
    healthy_margin:    h_margin,
    fair_value,
    reno_cost,
    reno_items,
    monthly_rent,
    huur_methode,
    wws_categorie:     wwsResult.categorie,
    wws_punten:        wwsResult.totaal,
    wws_max_huur:      wwsResult.max_huur,
    ...risicoResult,
    summary:           d.SUMMARY       || '',
    advice:            d.ADVICE        || '',
    full_analysis:     d.FULL_ANALYSIS || '',
    comps,
    kadaster:          kad,
    structured_source: structured ? 'funda_next_data' : 'ai_extraction',
    potentieel:        null, // geen 4e API-call op Hobby plan
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [url,       setUrl]       = useState('');
  const [loading,   setLoading]   = useState(false);
  const [step,      setStep]      = useState(0);
  const [data,      setData]      = useState(null);
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

  // ── Analyse (3 stappen) ───────────────────────────────────────────────────
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
    setStep(0);

    try {
      let d = {}, structured = null, text = '';

      if (isUrl(trimmed)) {
        // ── Stap 1: Pagina ophalen ─────────────────────────────────────────
        setStep(0);
        const scrapeRes = await fetch('/api/scrape', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: trimmed }),
        });
        const scrape = await scrapeRes.json();
        structured = scrape.structured;
        text       = scrape.text || '';

        // ── Stap 2: AI analyse ─────────────────────────────────────────────
        setStep(1);
        const aiRes = await fetch('/api/ai', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, structured }),
        });
        const aiJson = await aiRes.json();
        d = aiJson.d ?? {};
      }

      // ── Stap 3: Kadaster & PDOK ────────────────────────────────────────
      setStep(2);
      const address = d.ADDRESS || structured?.address || (isUrl(trimmed) ? '' : trimmed);
      if (!address) throw new Error('Kan geen adres bepalen uit de pagina. Probeer het adres direct in te voeren.');

      const kadRes = await fetch('/api/kadaster-data', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      const kad = await kadRes.json();

      // ── Resultaat samenstellen ─────────────────────────────────────────
      const result = buildResult({ url: trimmed, d, kad, structured });

      setData(result);
      setCached(trimmed, result);
      setTotalAcq(result.price * 1.115);
      setRenoState({ reno: result.reno_cost, uplift: result.reno_cost * 0.7, healthyMin: (result.price * 1.115 + result.reno_cost) * (result.healthy_margin / 100) });
      setActiveTab(0);

    } catch (e) {
      alert('Fout: ' + e.message);
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
      <aside style={{ width: 220, background: '#18181B', borderRight: '1px solid #27272A', padding: '24px 16px', flexShrink: 0, position: 'fixed', top: 0, left: 0, height: '100vh', overflowY: 'auto' }}>
        <div className="logo">Vastgoed</div>
        <div className="logo-sub">Investment Platform</div>
        <div className="sb-div" />
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && analyze()}
          placeholder="URL of adres (bijv. Hoofdstraat 1, Amsterdam)…"
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
                <button
                  onClick={() => {
                    setData(p);
                    setActiveTab(0);
                    setTotalAcq(p.price * 1.115);
                    setRenoState({ reno: p.reno_cost, uplift: p.reno_cost * 0.7, healthyMin: (p.price * 1.115 + p.reno_cost) * (p.healthy_margin / 100) });
                  }}
                  style={{ flex: 1, textAlign: 'left', padding: '8px 10px', background: '#27272A', border: '1px solid #3F3F46', borderRadius: 8, color: '#A1A1AA', fontSize: 11, cursor: 'pointer', lineHeight: 1.4 }}>
                  {(p.address ?? '').slice(0, 22)}…<br />{fmt(p.price)}
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
            <div className="hero"><div className="hero-img" /><div className="hero-content"><div className="hero-title">Vastgoedinvestering,<br />analytisch gemaakt.</div><div className="hero-desc">Plak een woninglink of typ een adres voor een compleet investeringsdossier — Kadasterdata, risicoscore, vergelijkbare verkopen en exitstrategie.</div></div></div>
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
                  {isUrl(data.url ?? '') && <>&nbsp;&nbsp;<a href={data.url} target="_blank" rel="noreferrer">Bekijk listing ↗</a></>}
                  {kad.bag_viewer_url && <>&nbsp;·&nbsp;<a href={kad.bag_viewer_url} target="_blank" rel="noreferrer">Open in Kadaster ↗</a></>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={() => window.print()} style={{ padding: '8px 16px', background: '#fff', color: '#1C1C1E', border: '1px solid #E4E4E7', borderRadius: 9, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>PDF exporteren</button>
                <button onClick={saveProperty} style={{ padding: '8px 16px', background: '#1C1C1E', color: '#FAFAFA', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Opslaan</button>
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
            <div style={{ display: 'flex', gap: 4, background: '#F4F4F5', borderRadius: 10, padding: 4, marginBottom: 16, width: 'fit-content' }}>
              {TABS.map((t, i) => (
                <button key={i} onClick={() => setActiveTab(i)} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, background: activeTab === i ? '#fff' : 'transparent', color: activeTab === i ? '#1C1C1E' : '#71717A', boxShadow: activeTab === i ? '0 1px 3px rgba(0,0,0,.08)' : 'none' }}>
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

        <div style={{ textAlign: 'center', fontSize: 11, color: '#C0BDB8', padding: '24px 0 8px' }}>
          Vastgoed Investment Platform · PDOK Kadaster BAG · Claude AI · {new Date().getFullYear()}
        </div>
      </main>
    </div>
  );
}
