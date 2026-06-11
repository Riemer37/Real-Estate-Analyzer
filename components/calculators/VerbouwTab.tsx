'use client';

import { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react';
import { Upload, Loader2, ChevronRight, ChevronLeft, AlertTriangle, CheckCircle, Sparkles } from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { jsonrepair } from 'jsonrepair';
import type { PropertyInput } from '@/lib/calc-types';
import { fmtEUR } from '@/lib/calculations';

// ── Types ──────────────────────────────────────────────────────────────────────

type Staat = 'uitstekend' | 'goed' | 'matig' | 'slecht';

interface Kamer {
  naam: string;
  huidigGebruik: string;
  oppervlakte: number | null;
  staat: Staat;
  bijzonderheden: string;
}

interface KamerChecklist extends Kamer {
  gewenstGebruik: string;
  acties: Record<string, string | boolean | number>;
}

interface PandPunten {
  gevel: string;
  dak: string;
  fundering: string;
  cv: string;
  elektra: string;
  riolering: string;
  isolatie: string;
  asbest: string;
}

interface PerRuimte {
  naam: string;
  laag: number;
  midden: number;
  hoog: number;
  toelichting: string;
}

interface Raming {
  laag: number;
  midden: number;
  hoog: number;
  perM2: number;
  doorlooptijd: string;
  onvoorzien: number;
  vergunningen: number;
  perRuimte: PerRuimte[];
}

interface Scenario {
  naam: string;
  verwachteOpbrengst?: number;
  investering?: number;
  nettoWinst?: number;
  roi?: number;
  doorlooptijd?: string;
  markthuurPerMaand?: number;
  bar?: number;
  nar?: number;
  hwm?: number;
  cashflowPerMaand?: number;
  terugverdientijd?: string;
  beschrijving?: string;
  geschatteNachthuur?: number;
  bezettingsgraad?: number;
  brutoJaaropbrengst?: number;
  vergelijking?: string;
  toelichting: string;
}

interface Eindadvies {
  aanbevolenScenario: string;
  reden: string;
  risicos: string[];
  volgendeStappen: string[];
}

interface RenovatieRaming {
  raming: Raming;
  scenarioA: Scenario;
  scenarioB: Scenario;
  scenarioC: Scenario;
  scenarioD: Scenario;
  eindadvies: Eindadvies;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const DEFAULT_PAND_PUNTEN: PandPunten = {
  gevel:     'handhaven',
  dak:       'handhaven',
  fundering: 'geen',
  cv:        'handhaven',
  elektra:   'handhaven',
  riolering: 'handhaven',
  isolatie:  'geen',
  asbest:    'niet_aanwezig',
};

const KAMER_VLOER_OPTIES = ['ongewijzigd', 'laminaat', 'pvc', 'parket', 'tegels', 'beton'] as const;
const KAMER_WAND_OPTIES  = ['ongewijzigd', 'schilderen', 'stucen', 'betegelen', 'behangen'] as const;
const KAMER_PLAF_OPTIES  = ['ongewijzigd', 'schilderen', 'stucen', 'spanplafond'] as const;
const KAMER_RAMEN_OPTIES = ['handhaven', 'hr++', 'triple', 'vervangen'] as const;

function makeChecklist(kamer: Kamer): KamerChecklist {
  return {
    ...kamer,
    gewenstGebruik: kamer.huidigGebruik,
    acties: {
      vloer:     'ongewijzigd',
      wanden:    'ongewijzigd',
      plafond:   'ongewijzigd',
      ramen:     'handhaven',
      keukenblok: false,
      sanitair:   false,
      leidingwerk: false,
      tegelwerk:  false,
    },
  };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fmt(n: number) { return fmtEUR(n); }

// ── Sub-components ─────────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: number }) {
  const steps = ['Upload plattegrond', 'Verbouwchecklist', 'Raming & Advies'];
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((label, i) => {
        const n = i + 1;
        const active = step === n;
        const done   = step > n;
        return (
          <div key={n} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 ${active ? 'text-navy' : done ? 'text-positive' : 'text-muted-foreground'}`}>
              <div className={`size-6 rounded-full flex items-center justify-center text-[11px] font-bold border-2 ${
                active ? 'border-navy bg-navy text-white'
                : done  ? 'border-positive bg-positive text-white'
                :         'border-border bg-background'
              }`}>
                {done ? '✓' : n}
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wide hidden sm:block">{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-px w-8 ${done ? 'bg-positive' : 'bg-border'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function KamerCard({
  kamer,
  index,
  onChange,
}: {
  kamer: KamerChecklist;
  index: number;
  onChange: (i: number, k: KamerChecklist) => void;
}) {
  const update = (patch: Partial<KamerChecklist>) => onChange(index, { ...kamer, ...patch });
  const updateActie = (key: string, val: string | boolean | number) =>
    onChange(index, { ...kamer, acties: { ...kamer.acties, [key]: val } });

  const staat = kamer.staat;
  const staatColor =
    staat === 'uitstekend' ? 'text-positive' :
    staat === 'goed' ? 'text-positive/70' :
    staat === 'matig' ? 'text-warning' : 'text-destructive';

  return (
    <div className="panel p-4 space-y-4">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-[160px]">
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold block mb-1">Naam</label>
          <input
            className="input-base w-full text-sm font-semibold"
            value={kamer.naam}
            onChange={e => update({ naam: e.target.value })}
          />
        </div>
        <div className="w-24">
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold block mb-1">m²</label>
          <input
            type="number"
            className="input-base w-full text-sm"
            value={kamer.oppervlakte ?? ''}
            onChange={e => update({ oppervlakte: e.target.value ? Number(e.target.value) : null })}
            placeholder="?"
          />
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold block mb-1">Huidige staat</label>
          <select
            className="input-base w-full text-sm"
            value={kamer.staat}
            onChange={e => update({ staat: e.target.value as Staat })}
          >
            <option value="uitstekend">Uitstekend</option>
            <option value="goed">Goed</option>
            <option value="matig">Matig</option>
            <option value="slecht">Slecht</option>
          </select>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold block mb-1">Gewenst gebruik</label>
          <input
            className="input-base w-full text-sm"
            value={kamer.gewenstGebruik}
            onChange={e => update({ gewenstGebruik: e.target.value })}
            placeholder="bijv. slaapkamer"
          />
        </div>
      </div>

      {kamer.bijzonderheden && (
        <p className="text-xs text-muted-foreground italic">AI-opmerking: {kamer.bijzonderheden}</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold block mb-1">Vloer</label>
          <select className="input-base w-full text-xs" value={String(kamer.acties.vloer)}
            onChange={e => updateActie('vloer', e.target.value)}>
            {KAMER_VLOER_OPTIES.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold block mb-1">Wanden</label>
          <select className="input-base w-full text-xs" value={String(kamer.acties.wanden)}
            onChange={e => updateActie('wanden', e.target.value)}>
            {KAMER_WAND_OPTIES.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold block mb-1">Plafond</label>
          <select className="input-base w-full text-xs" value={String(kamer.acties.plafond)}
            onChange={e => updateActie('plafond', e.target.value)}>
            {KAMER_PLAF_OPTIES.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold block mb-1">Ramen</label>
          <select className="input-base w-full text-xs" value={String(kamer.acties.ramen)}
            onChange={e => updateActie('ramen', e.target.value)}>
            {KAMER_RAMEN_OPTIES.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        {[
          { key: 'keukenblok',  label: 'Nieuw keukenblok' },
          { key: 'sanitair',    label: 'Nieuw sanitair' },
          { key: 'leidingwerk', label: 'Leidingwerk vernieuwen' },
          { key: 'tegelwerk',   label: 'Tegelwerk vernieuwen' },
        ].map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="accent-navy size-3.5"
              checked={Boolean(kamer.acties[key])}
              onChange={e => updateActie(key, e.target.checked)}
            />
            <span className="text-muted-foreground">{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function PandPuntenCard({
  punten,
  onChange,
}: {
  punten: PandPunten;
  onChange: (p: PandPunten) => void;
}) {
  const update = (key: keyof PandPunten, val: string) => onChange({ ...punten, [key]: val });

  const rows: { key: keyof PandPunten; label: string; opties: string[] }[] = [
    { key: 'gevel',     label: 'Gevel',              opties: ['handhaven', 'schilderen', 'renoveren', 'vervangen'] },
    { key: 'dak',       label: 'Dak',                opties: ['handhaven', 'repareren', 'vervangen', 'dakkapel'] },
    { key: 'fundering', label: 'Fundering',           opties: ['geen', 'onderzoek_gewenst', 'herstellen'] },
    { key: 'cv',        label: 'CV / verwarming',     opties: ['handhaven', 'servicen', 'vervangen', 'warmtepomp'] },
    { key: 'elektra',   label: 'Elektra',             opties: ['handhaven', 'updaten', 'volledig_renoveren'] },
    { key: 'riolering', label: 'Riolering',           opties: ['handhaven', 'renoveren'] },
    { key: 'isolatie',  label: 'Isolatie (na/vloer)', opties: ['geen', 'nader_onderzoek', 'vloer', 'na_vloer', 'volledig'] },
    { key: 'asbest',    label: 'Asbest',              opties: ['niet_aanwezig', 'vermoeden', 'bevestigd_saneren'] },
  ];

  return (
    <div className="panel p-5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-4">Pand-niveau</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {rows.map(({ key, label, opties }) => (
          <div key={key} className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground w-40 shrink-0">{label}</span>
            <select
              className="input-base flex-1 text-xs"
              value={punten[key]}
              onChange={e => update(key, e.target.value)}
            >
              {opties.map(o => (
                <option key={o} value={o}>
                  {o.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScenarioCard({
  letter,
  scenario,
  isAanbevolen,
}: {
  letter: string;
  scenario: Scenario;
  isAanbevolen: boolean;
}) {
  return (
    <div className={`panel p-5 relative ${isAanbevolen ? 'ring-2 ring-positive' : ''}`}>
      {isAanbevolen && (
        <div className="absolute -top-2.5 left-4">
          <span className="text-[10px] font-bold uppercase tracking-wider bg-positive text-white px-2 py-0.5 rounded-full">
            Aanbevolen
          </span>
        </div>
      )}
      <div className="flex items-center gap-2 mb-3">
        <span className="size-7 rounded-full bg-navy/10 text-navy text-sm font-bold flex items-center justify-center">{letter}</span>
        <span className="font-semibold text-sm text-foreground">{scenario.naam}</span>
      </div>
      <div className="space-y-1.5 text-sm">
        {scenario.verwachteOpbrengst !== undefined && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Verwachte opbrengst</span>
            <span className="font-semibold tabular">{fmt(scenario.verwachteOpbrengst)}</span>
          </div>
        )}
        {scenario.investering !== undefined && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Investering</span>
            <span className="font-semibold tabular text-warning">{fmt(scenario.investering)}</span>
          </div>
        )}
        {scenario.nettoWinst !== undefined && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Netto winst</span>
            <span className={`font-semibold tabular ${scenario.nettoWinst >= 0 ? 'text-positive' : 'text-destructive'}`}>
              {fmt(scenario.nettoWinst)}
            </span>
          </div>
        )}
        {scenario.roi !== undefined && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">ROI</span>
            <span className="font-semibold tabular">{scenario.roi.toFixed(1)}%</span>
          </div>
        )}
        {scenario.doorlooptijd !== undefined && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Doorlooptijd</span>
            <span className="font-medium">{scenario.doorlooptijd}</span>
          </div>
        )}
        {scenario.markthuurPerMaand !== undefined && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Markthuur/mnd</span>
            <span className="font-semibold tabular">{fmt(scenario.markthuurPerMaand)}</span>
          </div>
        )}
        {scenario.cashflowPerMaand !== undefined && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cashflow/mnd</span>
            <span className={`font-semibold tabular ${scenario.cashflowPerMaand >= 0 ? 'text-positive' : 'text-destructive'}`}>
              {fmt(scenario.cashflowPerMaand)}
            </span>
          </div>
        )}
        {scenario.bar !== undefined && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">BAR / NAR</span>
            <span className="font-semibold tabular">{scenario.bar.toFixed(1)}% / {scenario.nar?.toFixed(1)}%</span>
          </div>
        )}
        {scenario.hwm !== undefined && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">HWM</span>
            <span className="font-semibold tabular">{scenario.hwm.toFixed(1)}×</span>
          </div>
        )}
        {scenario.terugverdientijd !== undefined && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Terugverdientijd</span>
            <span className="font-medium">{scenario.terugverdientijd}</span>
          </div>
        )}
        {scenario.brutoJaaropbrengst !== undefined && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Bruto jaaropbrengst</span>
            <span className="font-semibold tabular">{fmt(scenario.brutoJaaropbrengst)}</span>
          </div>
        )}
        {scenario.bezettingsgraad !== undefined && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Bezettingsgraad</span>
            <span className="font-medium">{scenario.bezettingsgraad}%</span>
          </div>
        )}
      </div>
      {scenario.toelichting && (
        <p className="mt-3 text-xs text-muted-foreground border-t border-border pt-3 leading-relaxed">
          {scenario.toelichting}
        </p>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function VerbouwTab({ input }: { input: PropertyInput }) {
  const { user } = useUser();
  const isPro = user?.publicMetadata?.isPro === true;

  const [step,        setStep]        = useState<1 | 2 | 3>(1);
  const [dragging,    setDragging]    = useState(false);
  const [file,        setFile]        = useState<File | null>(null);
  const [analyzing,   setAnalyzing]   = useState(false);
  const [kamers,      setKamers]      = useState<KamerChecklist[]>([]);
  const [pandPunten,  setPandPunten]  = useState<PandPunten>(DEFAULT_PAND_PUNTEN);
  const [calculating, setCalculating] = useState(false);
  const [raming,      setRaming]      = useState<RenovatieRaming | null>(null);
  const [error,       setError]       = useState<string | null>(null);
  const [floorOpmerkingen, setFloorOpmerkingen] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Pro gate ──────────────────────────────────────────────────────────────────
  if (!isPro) {
    return (
      <div className="panel p-8 text-center space-y-4">
        <Sparkles className="size-10 text-warning mx-auto" />
        <h3 className="font-bold text-lg text-navy">Pro functie</h3>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
          Plattegrond analyse en verbouwramingen zijn beschikbaar in het Pro-abonnement. Upload een plattegrond, vul de checklist in en ontvang een gedetailleerde verbouwraming met 4 investeringsscenarios.
        </p>
        <Link href="/pricing" className="btn-primary inline-flex items-center gap-2 px-5 py-2.5">
          <Sparkles className="size-4" />
          Upgrade naar Pro
        </Link>
      </div>
    );
  }

  // ── File handling ─────────────────────────────────────────────────────────────
  const handleFile = (f: File) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(f.type)) {
      setError('Alleen JPG, PNG, WebP of PDF bestanden zijn toegestaan.');
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setError('Bestand is te groot (max 20 MB).');
      return;
    }
    setError(null);
    setFile(f);
  };

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  }, []);

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
  };

  // ── Step 1 → 2: Analyse plattegrond ──────────────────────────────────────────
  const analyseer = async () => {
    if (!file) return;
    setAnalyzing(true);
    setError(null);
    try {
      const base64    = await fileToBase64(file);
      const mediaType = file.type;
      const res = await fetch('/api/floorplan-analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mediaType }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setKamers((data.kamers ?? []).map(makeChecklist));
      setFloorOpmerkingen(data.opmerkingen ?? []);
      setStep(2);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Onbekende fout bij analyse.');
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Step 2 → 3: Verbouwraming ophalen ────────────────────────────────────────
  const berekenRaming = async () => {
    setCalculating(true);
    setError(null);
    try {
      const res = await fetch('/api/renovatie-raming', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kamers, pandPunten, property: input }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const reader  = res.body!.getReader();
      const decoder = new TextDecoder();
      let text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
      }
      const json = text.match(/\{[\s\S]*\}/)?.[0] ?? text;
      const data: RenovatieRaming = JSON.parse(jsonrepair(json));
      setRaming(data);
      setStep(3);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Onbekende fout bij verbouwraming.');
    } finally {
      setCalculating(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <StepIndicator step={step} />

      {error && (
        <div className="flex items-start gap-2 text-sm rounded-md border border-destructive/30 bg-destructive/10 text-destructive px-3 py-2.5">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Stap 1: Upload ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <div className="label-eyebrow mb-1">Stap 1</div>
            <h2 className="text-lg font-bold text-navy">Upload plattegrond</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Upload een plattegrond (JPG, PNG, WebP of PDF). De AI herkent automatisch alle ruimtes, oppervlaktes en bijzonderheden.
            </p>
          </div>

          <div
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
              dragging ? 'border-navy bg-navy/5' : file ? 'border-positive bg-positive/5' : 'border-border hover:border-navy/40 hover:bg-muted'
            }`}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={onInputChange}
            />
            {file ? (
              <div className="space-y-2">
                <CheckCircle className="size-10 text-positive mx-auto" />
                <p className="font-semibold text-sm text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB · Klik om te vervangen</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="size-10 text-muted-foreground/40 mx-auto" />
                <p className="text-sm font-medium text-muted-foreground">Sleep hier of klik om te uploaden</p>
                <p className="text-xs text-muted-foreground/60">JPG, PNG, WebP of PDF · max 20 MB</p>
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={!file || analyzing}
            onClick={analyseer}
            className="btn-primary flex items-center gap-2 px-6 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {analyzing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Plattegrond analyseren…
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                Analyseer plattegrond
                <ChevronRight className="size-4" />
              </>
            )}
          </button>
        </div>
      )}

      {/* ── Stap 2: Checklist ── */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="label-eyebrow mb-1">Stap 2</div>
              <h2 className="text-lg font-bold text-navy">Verbouwchecklist</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Controleer de ruimtes en geef per ruimte aan wat je wilt verbouwen. Voeg ook pand-niveau punten in.
              </p>
            </div>
            <button type="button" onClick={() => setStep(1)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <ChevronLeft className="size-4" />
              Terug
            </button>
          </div>

          {floorOpmerkingen.length > 0 && (
            <div className="panel p-4 space-y-1">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">AI-opmerkingen plattegrond</div>
              {floorOpmerkingen.map((o, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="size-3.5 text-warning shrink-0 mt-0.5" />
                  <span className="text-foreground/80">{o}</span>
                </div>
              ))}
            </div>
          )}

          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3">Ruimtes</div>
            <div className="space-y-3">
              {kamers.map((k, i) => (
                <KamerCard
                  key={i}
                  kamer={k}
                  index={i}
                  onChange={(idx, updated) =>
                    setKamers(prev => prev.map((k2, j) => (j === idx ? updated : k2)))
                  }
                />
              ))}
              {kamers.length === 0 && (
                <p className="text-sm text-muted-foreground">Geen ruimtes herkend. Voeg handmatig toe.</p>
              )}
              <button
                type="button"
                className="text-sm text-navy hover:underline"
                onClick={() =>
                  setKamers(prev => [
                    ...prev,
                    makeChecklist({ naam: 'Nieuwe ruimte', huidigGebruik: '', oppervlakte: null, staat: 'goed', bijzonderheden: '' }),
                  ])
                }
              >
                + Ruimte toevoegen
              </button>
            </div>
          </div>

          <PandPuntenCard punten={pandPunten} onChange={setPandPunten} />

          <button
            type="button"
            disabled={calculating}
            onClick={berekenRaming}
            className="btn-primary flex items-center gap-2 px-6 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {calculating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Verbouwraming berekenen…
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                Bereken verbouwraming
                <ChevronRight className="size-4" />
              </>
            )}
          </button>
        </div>
      )}

      {/* ── Stap 3: Resultaten ── */}
      {step === 3 && raming && (
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="label-eyebrow mb-1">Stap 3</div>
              <h2 className="text-lg font-bold text-navy">Verbouwraming & Advies</h2>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(2)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                <ChevronLeft className="size-4" />
                Checklist aanpassen
              </button>
              <button type="button" onClick={() => { setStep(1); setFile(null); setRaming(null); setKamers([]); }}
                className="text-sm text-muted-foreground hover:text-foreground border border-border rounded-md px-3 py-1.5">
                Opnieuw beginnen
              </button>
            </div>
          </div>

          {/* Totaalraming */}
          <div className="panel p-5">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-4">Totale verbouwraming</div>
            <div className="grid grid-cols-3 gap-4 mb-5">
              {[
                { label: 'Laag scenario',   value: raming.raming.laag,   color: 'text-positive' },
                { label: 'Midden scenario', value: raming.raming.midden, color: 'text-navy' },
                { label: 'Hoog scenario',   value: raming.raming.hoog,   color: 'text-warning' },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center">
                  <div className={`text-2xl font-extrabold tabular ${color}`}>{fmt(value)}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">{label}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-border pt-4 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">Per m²</span>
                <div className="font-semibold tabular">€ {raming.raming.perM2.toLocaleString('nl-NL')}</div>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Doorlooptijd</span>
                <div className="font-semibold">{raming.raming.doorlooptijd}</div>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Onvoorzien</span>
                <div className="font-semibold tabular">{fmt(raming.raming.onvoorzien)}</div>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Vergunningen</span>
                <div className="font-semibold tabular">{fmt(raming.raming.vergunningen)}</div>
              </div>
            </div>
          </div>

          {/* Per ruimte */}
          {raming.raming.perRuimte && raming.raming.perRuimte.length > 0 && (
            <div className="panel p-5">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3">Raming per ruimte</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-4 text-xs font-semibold text-muted-foreground">Ruimte</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Laag</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Midden</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Hoog</th>
                      <th className="text-left py-2 pl-4 text-xs font-semibold text-muted-foreground hidden md:table-cell">Toelichting</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {raming.raming.perRuimte.map((r, i) => (
                      <tr key={i}>
                        <td className="py-2 pr-4 font-medium">{r.naam}</td>
                        <td className="py-2 px-3 text-right tabular text-positive">{fmt(r.laag)}</td>
                        <td className="py-2 px-3 text-right tabular font-semibold">{fmt(r.midden)}</td>
                        <td className="py-2 px-3 text-right tabular text-warning">{fmt(r.hoog)}</td>
                        <td className="py-2 pl-4 text-xs text-muted-foreground hidden md:table-cell">{r.toelichting}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4 Scenario's */}
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3">Investeringsscenario's na verbouw</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([
                { letter: 'A', data: raming.scenarioA },
                { letter: 'B', data: raming.scenarioB },
                { letter: 'C', data: raming.scenarioC },
                { letter: 'D', data: raming.scenarioD },
              ] as const).map(({ letter, data }) => (
                <ScenarioCard
                  key={letter}
                  letter={letter}
                  scenario={data}
                  isAanbevolen={raming.eindadvies.aanbevolenScenario === letter}
                />
              ))}
            </div>
          </div>

          {/* Eindadvies */}
          <div className="panel p-5 border-l-4 border-l-navy">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-3">Eindadvies</div>
            <div className="flex items-start gap-3 mb-4">
              <div className="size-8 rounded-full bg-navy text-white text-sm font-bold flex items-center justify-center shrink-0">
                {raming.eindadvies.aanbevolenScenario}
              </div>
              <p className="text-sm text-foreground leading-relaxed">{raming.eindadvies.reden}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Risico's</div>
                <ul className="space-y-1">
                  {raming.eindadvies.risicos.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="size-3.5 text-warning shrink-0 mt-0.5" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Volgende stappen</div>
                <ol className="space-y-1">
                  {raming.eindadvies.volgendeStappen.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="size-4 rounded-full bg-navy/10 text-navy text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
