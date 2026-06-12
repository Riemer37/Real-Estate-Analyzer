'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import type { PropertyInput, KadasterInfo, EnergyLabel, WoningType, Conditie, Bestemmingsplan, HuurcontractType, Unit, UnitGebruik } from '@/lib/calc-types';
import AddressAutocomplete from '@/components/AddressAutocomplete';

const INPUT_CLS = 'w-full bg-background border border-border rounded-md px-3 py-2 tabular text-sm';
const SELECT_CLS = 'w-full bg-background border border-border rounded-md px-3 py-2 tabular text-sm';
const LABEL_CLS = 'text-xs font-medium text-muted-foreground';
const SECTION_HDR = 'text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3';

const DEFAULT_INPUT: PropertyInput = {
  adres: '',
  vraagprijs: 0,
  woonoppervlakte: 0,
  perceeloppervlakte: null,
  energielabel: 'C',
  typeWoning: 'tussenwoning',
  aantalKamers: 4,
  conditie: 'redelijk',
  erfpacht: false,
  wozWaarde: 0,
  renovatiekostenPerM2: null,
  eigenGebruik: true,
  notariskosten: 1500,
  taxatiekosten: 600,
  bouwkundigeKeuring: 400,
  overigeKosten: 0,
  referentieprijsPerM2: null,
  bestemmingsplan: 'onbekend',
  verwachteHuurprijs: null,
  huidigeHuurprijs: null,
  huurcontractType: 'onbekend',
  vasteLastenPerMaand: null,
  isMultiUnit: false,
  units: [],
};

interface InputFormProps {
  onCalculate: (input: PropertyInput, kad: KadasterInfo) => void;
  initialInput?: PropertyInput | null;
  initialKad?: KadasterInfo | null;
}

function numVal(v: number): string | number {
  return v === 0 ? '' : v;
}

function parseNum(s: string): number {
  const n = parseFloat(s.replace(',', '.'));
  return isFinite(n) ? n : 0;
}

export default function InputForm({ onCalculate, initialInput, initialKad }: InputFormProps) {
  const [input, setInput] = useState<PropertyInput>(initialInput ?? DEFAULT_INPUT);
  const [kad, setKad] = useState<KadasterInfo | null>(initialKad ?? null);
  const [bagLoading, setBagLoading] = useState(false);
  const [bagError, setBagError] = useState<string | null>(null);
  const [perceelNvt, setPerceelNvt] = useState(initialInput?.perceeloppervlakte === null && !initialInput?.perceeloppervlakte);
  const [wozAutoFilled, setWozAutoFilled] = useState(false);

  const set = <K extends keyof PropertyInput>(k: K, v: PropertyInput[K]) =>
    setInput(prev => ({ ...prev, [k]: v }));

  const handleBagSearch = async (addressOverride?: string) => {
    const addr = addressOverride ?? input.adres;
    if (!addr.trim()) return;
    setBagLoading(true);
    setBagError(null);
    setKad(null);
    setWozAutoFilled(false);

    try {
      const res = await fetch('/api/kadaster-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr }),
      });
      const data = await res.json();

      const kadInfo: KadasterInfo = {
        found: data.found,
        officielAdres: data.official_address,
        woonplaats: data.woonplaats,
        gemeente: data.gemeentenaam,
        buurt: data.buurtnaam,
        bagId: data.bag_id,
        isRijksmonument: data.is_rijksmonument ?? false,
        beschermdGezicht: data.is_beschermd_gezicht
          ? (data.beschermd_gezicht_naam ?? 'Beschermd gezicht')
          : null,
        vboCount: data.vbo_count,
        isSplit: data.is_split,
        gebruiksdoel: data.usage,
        status: data.status,
        wozHistory: (data.woz_waarden ?? []).map((w: { jaar: string | number; waarde: number }) => ({
          jaar: typeof w.jaar === 'string' ? parseInt(w.jaar) : w.jaar,
          waarde: w.waarde,
        })),
        wozHuidig: data.woz_huidig,
        energielabelEP: data.energy_label,
        perceelOppervlakte: data.perceel_oppervlakte,
        officielSqm: data.official_sqm,
        lat: data.lat,
        lon: data.lon,
        cbsGemWoningWaarde: data.cbs_gem_woningwaarde ?? undefined,
        cbsPctKoop: data.cbs_pct_koop ?? undefined,
        cbsPctHuur: data.cbs_pct_huur ?? undefined,
        cbsGemInkomen: data.cbs_gem_inkomen ?? undefined,
        cbsLeegstand: data.cbs_leegstand ?? undefined,
        gemKoopsomBuurt: data.gem_koopsom_buurt ?? undefined,
        koopsomAantal: data.koopsommen?.length ?? undefined,
        rpNaam: data.rp_naam ?? undefined,
        rpPlanDatum: data.rp_plan_datum ?? undefined,
        rpBestemming: data.rp_bestemming ?? undefined,
        rpHoofdgroep: data.rp_hoofdgroep ?? undefined,
        rpId: data.rp_id ?? undefined,
        rpViewerUrl: data.rp_viewer_url ?? undefined,
      };

      setKad(kadInfo);

      if (!kadInfo.found) {
        setBagError('Adres niet gevonden in BAG');
        return;
      }

      setInput(prev => {
        const next = { ...prev };
        if (kadInfo.wozHuidig) {
          next.wozWaarde = kadInfo.wozHuidig;
          setWozAutoFilled(true);
        }
        if (kadInfo.energielabelEP) {
          next.energielabel = kadInfo.energielabelEP as EnergyLabel;
        }
        return next;
      });
    } catch {
      setBagError('Fout bij ophalen BAG data');
    } finally {
      setBagLoading(false);
    }
  };

  const isValid =
    input.adres.trim() !== '' &&
    input.vraagprijs > 0 &&
    input.woonoppervlakte > 0;

  const handleSubmit = () => {
    if (!isValid) return;
    const effectiveKad: KadasterInfo = kad ?? {
      found: false,
      isRijksmonument: false,
      beschermdGezicht: null,
      wozHistory: [],
    };
    onCalculate(input, effectiveKad);
  };

  return (
    <div className="space-y-4">
      {/* Section 1: Locatie */}
      <div className="panel p-5 space-y-4">
        <div className={SECTION_HDR}>Locatie</div>

        <div className="space-y-1.5">
          <label className={LABEL_CLS}>Adres</label>
          <AddressAutocomplete
            value={input.adres}
            onChange={v => set('adres', v)}
            onSelect={s => {
              set('adres', s.weergavenaam);
              handleBagSearch(s.weergavenaam);
            }}
            className={INPUT_CLS}
          />
          <p className="text-[11px] text-muted-foreground">Typ minimaal 3 tekens voor suggesties · BAG wordt automatisch opgezocht bij selectie</p>
        </div>

        <button
          type="button"
          onClick={() => handleBagSearch()}
          disabled={bagLoading || !input.adres.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-navy text-white rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {bagLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : null}
          {bagLoading ? 'Ophalen…' : 'Zoek BAG data'}
        </button>

        {kad?.found && (
          <div className="rounded-md border border-positive/30 bg-positive/8 px-3 py-2.5 space-y-1.5">
            <div className="flex items-center gap-2 text-positive text-sm font-medium">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>BAG gevonden: {kad.officielAdres}</span>
            </div>
            {kad.isRijksmonument && (
              <div className="flex items-start gap-2 text-warning text-xs">
                <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                <span>Rijksmonument — verbouwing vereist vergunning Rijksdienst voor het Cultureel Erfgoed.</span>
              </div>
            )}
            {kad.beschermdGezicht && (
              <div className="flex items-start gap-2 text-warning text-xs">
                <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                <span>Beschermd gezicht: {kad.beschermdGezicht}. Wijzigingen exterieur beperkt mogelijk.</span>
              </div>
            )}
          </div>
        )}

        {bagError && (
          <div className="flex items-center gap-2 text-destructive text-sm rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2.5">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{bagError}</span>
          </div>
        )}
      </div>

      {/* Section 2: Financieel */}
      <div className="panel p-5 space-y-4">
        <div className={SECTION_HDR}>Financieel</div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={LABEL_CLS}>Vraagprijs (€)</label>
            <input
              type="number"
              value={numVal(input.vraagprijs)}
              onChange={e => set('vraagprijs', parseNum(e.target.value))}
              placeholder="350000"
              min={0}
              className={INPUT_CLS}
            />
          </div>

          <div className="space-y-1.5">
            <label className={LABEL_CLS}>
              WOZ waarde (€)
              {wozAutoFilled && (
                <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold source-bag">
                  BAG
                </span>
              )}
            </label>
            <input
              type="number"
              value={numVal(input.wozWaarde)}
              onChange={e => {
                set('wozWaarde', parseNum(e.target.value));
                setWozAutoFilled(false);
              }}
              placeholder="320000"
              min={0}
              className={INPUT_CLS}
            />
          </div>
        </div>
      </div>

      {/* Section: Verbouwingskosten per m² */}
      <div className="panel p-5 space-y-4">
        <div className={SECTION_HDR}>Verbouwingskosten per m²</div>

        <div className="space-y-1.5">
          <label className={LABEL_CLS}>Verbouwingskosten per m²</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground shrink-0">€</span>
            <input
              type="number"
              value={input.renovatiekostenPerM2 === null ? '' : input.renovatiekostenPerM2}
              onChange={e => set('renovatiekostenPerM2', e.target.value === '' ? null : parseNum(e.target.value))}
              placeholder="bijv. 500"
              min={0}
              className={INPUT_CLS}
            />
            <span className="text-sm text-muted-foreground shrink-0">per m²</span>
          </div>
        </div>

        {input.renovatiekostenPerM2 !== null && input.renovatiekostenPerM2 > 0 && input.woonoppervlakte > 0 && (
          <div className="rounded-md bg-muted px-3 py-2.5 text-sm tabular">
            <span className="text-muted-foreground">
              € {input.renovatiekostenPerM2.toLocaleString('nl-NL')} × {input.woonoppervlakte} m² =&nbsp;
            </span>
            <span className="font-semibold text-foreground">
              € {(input.renovatiekostenPerM2 * input.woonoppervlakte).toLocaleString('nl-NL')}
            </span>
          </div>
        )}
      </div>

      {/* Section: Aankoopkosten — centraal voor Max Bod én Verkoop tab */}
      <div className="panel p-5 space-y-4">
        <div className={SECTION_HDR}>Aankoopkosten</div>

        <div>
          <label className={LABEL_CLS}>OVB (overdrachtsbelasting)</label>
          <div className="mt-1.5 flex gap-2">
            <button
              type="button"
              onClick={() => set('eigenGebruik', true)}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                input.eigenGebruik
                  ? 'bg-navy text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              Eigen gebruik (2%)
            </button>
            <button
              type="button"
              onClick={() => set('eigenGebruik', false)}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                !input.eigenGebruik
                  ? 'bg-navy text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              Belegging (10,4%)
            </button>
          </div>
          {input.vraagprijs > 0 && (
            <div className="mt-2 rounded-md bg-muted px-3 py-2 text-sm tabular">
              <span className="text-muted-foreground">
                OVB: {input.eigenGebruik ? '2%' : '10,4%'} × € {input.vraagprijs.toLocaleString('nl-NL')} =&nbsp;
              </span>
              <span className="font-semibold text-foreground">
                € {Math.round(input.vraagprijs * (input.eigenGebruik ? 0.02 : 0.104)).toLocaleString('nl-NL')}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={LABEL_CLS}>Notariskosten (€)</label>
            <input
              type="number"
              value={input.notariskosten}
              onChange={e => set('notariskosten', parseNum(e.target.value))}
              min={0}
              className={INPUT_CLS}
            />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL_CLS}>Taxatiekosten (€)</label>
            <input
              type="number"
              value={input.taxatiekosten}
              onChange={e => set('taxatiekosten', parseNum(e.target.value))}
              min={0}
              className={INPUT_CLS}
            />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL_CLS}>Bouwkundige keuring (€)</label>
            <input
              type="number"
              value={input.bouwkundigeKeuring}
              onChange={e => set('bouwkundigeKeuring', parseNum(e.target.value))}
              min={0}
              className={INPUT_CLS}
            />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL_CLS}>Overige kosten (€)</label>
            <input
              type="number"
              value={input.overigeKosten}
              onChange={e => set('overigeKosten', parseNum(e.target.value))}
              min={0}
              className={INPUT_CLS}
            />
          </div>
        </div>
      </div>

      {/* Section: Verkoopwaarde na verbouwing — centraal voor Max Bod én Verkoop tab */}
      <div className="panel p-5 space-y-4">
        <div className={SECTION_HDR}>Verkoopwaarde na verbouwing</div>

        <div className="space-y-1.5">
          <label className={LABEL_CLS}>
            Wat zijn vergelijkbare verbouwde panden in de buurt waard per m²?
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground shrink-0">€</span>
            <input
              type="number"
              value={input.referentieprijsPerM2 === null ? '' : input.referentieprijsPerM2}
              onChange={e => set('referentieprijsPerM2', e.target.value === '' ? null : parseNum(e.target.value))}
              placeholder="bijv. 9.000"
              min={0}
              className={INPUT_CLS}
            />
            <span className="text-sm text-muted-foreground shrink-0">per m²</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Kijk op Funda naar recent verkochte verbouwde panden in de buurt
          </p>
        </div>

        {input.referentieprijsPerM2 !== null && input.referentieprijsPerM2 > 0 && input.woonoppervlakte > 0 && (
          <div className="rounded-md bg-muted px-3 py-2.5 text-sm tabular">
            <span className="text-muted-foreground">
              € {input.referentieprijsPerM2.toLocaleString('nl-NL')} × {input.woonoppervlakte} m² =&nbsp;
            </span>
            <span className="font-semibold text-foreground">
              € {(input.referentieprijsPerM2 * input.woonoppervlakte).toLocaleString('nl-NL')}
            </span>
          </div>
        )}
      </div>

      {/* Section 3: Woning */}
      <div className="panel p-5 space-y-4">
        <div className={SECTION_HDR}>Woning</div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className={LABEL_CLS}>Woonoppervlakte (m²)</label>
            <input
              type="number"
              value={numVal(input.woonoppervlakte)}
              onChange={e => set('woonoppervlakte', parseNum(e.target.value))}
              placeholder="85"
              min={0}
              className={INPUT_CLS}
            />
          </div>

          <div className="space-y-1.5">
            <label className={LABEL_CLS}>Perceeloppervlakte (m²)</label>
            <input
              type="number"
              value={perceelNvt ? '' : (input.perceeloppervlakte === null ? '' : input.perceeloppervlakte)}
              onChange={e => set('perceeloppervlakte', e.target.value === '' ? null : parseNum(e.target.value))}
              placeholder="150"
              min={0}
              disabled={perceelNvt}
              className={INPUT_CLS + (perceelNvt ? ' opacity-40' : '')}
            />
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={perceelNvt}
                onChange={e => {
                  setPerceelNvt(e.target.checked);
                  if (e.target.checked) set('perceeloppervlakte', null);
                }}
                className="rounded border-border"
              />
              N.v.t.
            </label>
          </div>

          <div className="space-y-1.5">
            <label className={LABEL_CLS}>Energielabel</label>
            <select
              value={input.energielabel}
              onChange={e => set('energielabel', e.target.value as EnergyLabel)}
              className={SELECT_CLS}
            >
              {(['A+++', 'A++', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'Onbekend'] as EnergyLabel[]).map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className={LABEL_CLS}>Type woning</label>
            <select
              value={input.typeWoning}
              onChange={e => set('typeWoning', e.target.value as WoningType)}
              className={SELECT_CLS}
            >
              <option value="tussenwoning">Tussenwoning</option>
              <option value="hoekwoning">Hoekwoning</option>
              <option value="vrijstaand">Vrijstaand</option>
              <option value="appartement">Appartement</option>
              <option value="bovenwoning">Bovenwoning</option>
              <option value="commercieel">Commercieel</option>
              <option value="zorg">Zorgpand</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className={LABEL_CLS}>Aantal kamers</label>
            <input
              type="number"
              value={numVal(input.aantalKamers)}
              onChange={e => set('aantalKamers', parseNum(e.target.value))}
              placeholder="4"
              min={1}
              className={INPUT_CLS}
            />
          </div>
        </div>
      </div>

      {/* Section 4: Staat */}
      <div className="panel p-5 space-y-4">
        <div className={SECTION_HDR}>Staat</div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={LABEL_CLS}>Staat van onderhoud</label>
            <select
              value={input.conditie}
              onChange={e => set('conditie', e.target.value as Conditie)}
              className={SELECT_CLS}
            >
              <option value="uitstekend">Uitstekend</option>
              <option value="goed">Goed</option>
              <option value="redelijk">Redelijk</option>
              <option value="slecht">Slecht</option>
              <option value="te_renoveren">Te renoveren</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className={LABEL_CLS}>Erfpacht</label>
            <div className="pt-1">
              <button
                type="button"
                onClick={() => set('erfpacht', !input.erfpacht)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  input.erfpacht
                    ? 'bg-navy text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {input.erfpacht ? 'Ja — erfpacht' : 'Nee — eigen grond'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Section: Investeringsprofiel — voor AI analyse */}
      <div className="panel p-5 space-y-4">
        <div className={SECTION_HDR}>Investeringsprofiel <span className="normal-case font-normal text-muted-foreground/70 ml-1">— voor AI analyse</span></div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={LABEL_CLS}>Bestemmingsplan</label>
            <select
              value={input.bestemmingsplan}
              onChange={e => set('bestemmingsplan', e.target.value as Bestemmingsplan)}
              className={SELECT_CLS}
            >
              <option value="onbekend">Onbekend</option>
              <option value="wonen">Wonen</option>
              <option value="gemengd">Gemengd (wonen + commercieel)</option>
              <option value="commercieel">Commercieel</option>
              <option value="bedrijf">Bedrijf</option>
              <option value="agrarisch">Agrarisch</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className={LABEL_CLS}>Verwachte huurprijs (€/maand)</label>
            <input
              type="number"
              value={input.verwachteHuurprijs === null ? '' : input.verwachteHuurprijs}
              onChange={e => set('verwachteHuurprijs', e.target.value === '' ? null : parseNum(e.target.value))}
              placeholder="bijv. 1500"
              min={0}
              className={INPUT_CLS}
            />
          </div>

        </div>
      </div>

      {/* Section: Verhuurd pand */}
      <div className="panel p-5 space-y-4">
        <div className={SECTION_HDR}>Verhuurd pand <span className="normal-case font-normal text-muted-foreground/70 ml-1">— optioneel, voor HWM analyse</span></div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={LABEL_CLS}>Huidige maandhuur (€)</label>
            <input
              type="number"
              value={input.huidigeHuurprijs === null ? '' : input.huidigeHuurprijs}
              onChange={e => set('huidigeHuurprijs', e.target.value === '' ? null : parseNum(e.target.value))}
              placeholder="bijv. 1500"
              min={0}
              className={INPUT_CLS}
            />
          </div>

          <div className="space-y-1.5">
            <label className={LABEL_CLS}>Huurcontract type</label>
            <select
              value={input.huurcontractType}
              onChange={e => set('huurcontractType', e.target.value as HuurcontractType)}
              className={SELECT_CLS}
            >
              <option value="onbekend">Onbekend</option>
              <option value="vrije_sector">Vrije sector</option>
              <option value="sociaal">Sociale huur</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className={LABEL_CLS}>Vaste lasten (€/maand)</label>
            <input
              type="number"
              value={input.vasteLastenPerMaand === null ? '' : input.vasteLastenPerMaand}
              onChange={e => set('vasteLastenPerMaand', e.target.value === '' ? null : parseNum(e.target.value))}
              placeholder="OZB + verzekering + beheer"
              min={0}
              className={INPUT_CLS}
            />
            <p className="text-[11px] text-muted-foreground">Voor NAR berekening</p>
          </div>
        </div>
      </div>

      {/* Section: Multi-unit */}
      <div className="panel p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className={SECTION_HDR}>Multi-unit pand <span className="normal-case font-normal text-muted-foreground/70 ml-1">— optioneel</span></div>
          <button
            type="button"
            onClick={() => {
              const next = !input.isMultiUnit;
              set('isMultiUnit', next);
              if (next && (!input.units || input.units.length === 0)) {
                set('units', [makeUnit(1), makeUnit(2)]);
              }
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              input.isMultiUnit ? 'bg-navy text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            {input.isMultiUnit ? 'Aan' : 'Uit'}
          </button>
        </div>

        {input.isMultiUnit && (
          <div className="space-y-3">
            {(input.units ?? []).map((unit, idx) => (
              <div key={unit.id} className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Unit {idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => set('units', input.units.filter(u => u.id !== unit.id))}
                    className="text-xs text-destructive hover:underline"
                  >Verwijderen</button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1">
                    <label className={LABEL_CLS}>Omschrijving</label>
                    <input type="text" value={unit.omschrijving}
                      onChange={e => set('units', input.units.map(u => u.id === unit.id ? { ...u, omschrijving: e.target.value } : u))}
                      className={INPUT_CLS} placeholder="bijv. Appartement BG links" />
                  </div>
                  <div className="space-y-1">
                    <label className={LABEL_CLS}>Oppervlakte (m²)</label>
                    <input type="number" value={unit.oppervlakte || ''} min={0}
                      onChange={e => set('units', input.units.map(u => u.id === unit.id ? { ...u, oppervlakte: parseNum(e.target.value) } : u))}
                      className={INPUT_CLS} placeholder="85" />
                  </div>
                  <div className="space-y-1">
                    <label className={LABEL_CLS}>Gebruik</label>
                    <select value={unit.gebruik}
                      onChange={e => set('units', input.units.map(u => u.id === unit.id ? { ...u, gebruik: e.target.value as UnitGebruik } : u))}
                      className={SELECT_CLS}>
                      <option value="verhuurd">Verhuurd</option>
                      <option value="leeg">Leeg</option>
                      <option value="eigen_gebruik">Eigen gebruik</option>
                    </select>
                  </div>
                  {unit.gebruik === 'verhuurd' && (<>
                    <div className="space-y-1">
                      <label className={LABEL_CLS}>Maandhuur (€)</label>
                      <input type="number" value={unit.maandhuur ?? ''} min={0}
                        onChange={e => set('units', input.units.map(u => u.id === unit.id ? { ...u, maandhuur: e.target.value === '' ? null : parseNum(e.target.value) } : u))}
                        className={INPUT_CLS} placeholder="1200" />
                    </div>
                    <div className="space-y-1">
                      <label className={LABEL_CLS}>Huurcontract</label>
                      <select value={unit.huurcontractType}
                        onChange={e => set('units', input.units.map(u => u.id === unit.id ? { ...u, huurcontractType: e.target.value as HuurcontractType } : u))}
                        className={SELECT_CLS}>
                        <option value="onbekend">Onbekend</option>
                        <option value="vrije_sector">Vrije sector</option>
                        <option value="sociaal">Sociale huur</option>
                        <option value="bedrijfsruimte">Bedrijfsruimte</option>
                      </select>
                    </div>
                  </>)}
                  <div className="space-y-1">
                    <label className={LABEL_CLS}>Staat</label>
                    <select value={unit.conditie}
                      onChange={e => set('units', input.units.map(u => u.id === unit.id ? { ...u, conditie: e.target.value as Conditie } : u))}
                      className={SELECT_CLS}>
                      <option value="uitstekend">Uitstekend</option>
                      <option value="goed">Goed</option>
                      <option value="redelijk">Redelijk</option>
                      <option value="slecht">Slecht</option>
                      <option value="te_renoveren">Te renoveren</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className={LABEL_CLS}>Leegwaarde (€)</label>
                    <input type="number" value={unit.leegwaarde ?? ''} min={0}
                      onChange={e => set('units', input.units.map(u => u.id === unit.id ? { ...u, leegwaarde: e.target.value === '' ? null : parseNum(e.target.value) } : u))}
                      className={INPUT_CLS} placeholder="Vrije verkoopwaarde" />
                  </div>
                  <div className="space-y-1">
                    <label className={LABEL_CLS}>VvE kosten (€/mnd)</label>
                    <input type="number" value={unit.vveKostenPerMaand ?? ''} min={0}
                      onChange={e => set('units', input.units.map(u => u.id === unit.id ? { ...u, vveKostenPerMaand: e.target.value === '' ? null : parseNum(e.target.value) } : u))}
                      className={INPUT_CLS} placeholder="0 = geen VvE" />
                  </div>
                  <div className="space-y-1">
                    <label className={LABEL_CLS}>Renov.kosten (€/m²)</label>
                    <input type="number" value={unit.renovatiekostenPerM2 ?? ''} min={0}
                      onChange={e => set('units', input.units.map(u => u.id === unit.id ? { ...u, renovatiekostenPerM2: e.target.value === '' ? null : parseNum(e.target.value) } : u))}
                      className={INPUT_CLS} placeholder="Leeg = geen renov." />
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => set('units', [...(input.units ?? []), makeUnit((input.units?.length ?? 0) + 1)])}
              className="w-full py-2 rounded-md border border-dashed border-border text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
            >+ Unit toevoegen</button>
          </div>
        )}
      </div>

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!isValid}
        className="w-full py-3.5 bg-navy text-white rounded-md text-[15px] font-semibold tracking-wide disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
      >
        Analyseer &amp; Bereken
      </button>
    </div>
  );
}

function makeUnit(n: number): Unit {
  return {
    id: Math.random().toString(36).slice(2),
    omschrijving: `Unit ${n}`,
    oppervlakte: 0,
    gebruik: 'leeg',
    maandhuur: null,
    huurcontractType: 'onbekend',
    energielabel: 'Onbekend',
    conditie: 'redelijk',
    renovatiekostenPerM2: null,
    leegwaarde: null,
    vveKostenPerMaand: null,
  };
}
