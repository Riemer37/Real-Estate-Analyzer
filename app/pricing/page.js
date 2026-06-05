import Link from 'next/link';
import UpgradeButton from '@/components/UpgradeButton';

const FREE_FEATURES = [
  'Max Bod, Verhuur, Verkoop & Belasting calculators',
  'Kadaster & BAG data automatisch opvragen',
  'Tot 5 opgeslagen analyses',
];

const PRO_FEATURES = [
  'Alles uit het gratis plan',
  'Onbeperkt analyses opslaan',
  'AI Investeringsanalyse (these, risico, transformatieadvies)',
  'PDF export — binnenkort',
  'Portfolio overzicht — binnenkort',
];

export default function PricingPage({ searchParams }) {
  const success = searchParams?.success === 'true';

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <div className="text-center mb-12">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Prijzen</div>
        <h1 className="text-3xl font-extrabold text-navy">Kies jouw plan</h1>
        <p className="text-muted-foreground mt-2">Gratis te gebruiken. Upgrade als je meer nodig hebt.</p>
      </div>

      {success && (
        <div className="mb-8 flex items-center gap-3 rounded-md border border-positive/30 bg-positive/5 px-4 py-3 text-sm text-positive font-medium max-w-lg mx-auto justify-center">
          ✓ Welkom bij Pro! Je account is geactiveerd.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">

        {/* Gratis */}
        <div className="panel p-8 space-y-6">
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Gratis</div>
            <div className="text-4xl font-extrabold text-navy mt-1">€0</div>
            <div className="text-sm text-muted-foreground mt-1">Altijd gratis, geen creditcard nodig</div>
          </div>
          <ul className="space-y-3">
            {FREE_FEATURES.map(f => (
              <li key={f} className="flex items-start gap-2.5 text-sm">
                <span className="text-positive font-bold mt-0.5 shrink-0">✓</span>
                <span>{f}</span>
              </li>
            ))}
            <li className="flex items-start gap-2.5 text-sm text-muted-foreground/60">
              <span className="font-bold mt-0.5 shrink-0">✗</span>
              <span>AI Investeringsanalyse</span>
            </li>
          </ul>
          <Link
            href="/"
            className="block w-full text-center px-5 py-2.5 border border-border rounded-md text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
          >
            Gebruik gratis
          </Link>
        </div>

        {/* Pro */}
        <div className="panel p-8 space-y-6 ring-2 ring-primary/30 relative overflow-hidden">
          <div className="absolute top-4 right-4 text-[10px] uppercase tracking-wide font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
            Aanbevolen
          </div>
          <div>
            <div className="text-xs font-semibold text-primary uppercase tracking-wide">Pro</div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-4xl font-extrabold text-navy">€19</span>
              <span className="text-sm text-muted-foreground">/ maand</span>
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              of{' '}
              <span className="font-semibold text-foreground">€149 / jaar</span>
              <span className="ml-1.5 text-positive font-semibold text-[11px]">−35%</span>
            </div>
          </div>
          <ul className="space-y-3">
            {PRO_FEATURES.map(f => (
              <li key={f} className="flex items-start gap-2.5 text-sm">
                <span className="text-positive font-bold mt-0.5 shrink-0">✓</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <UpgradeButton />
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground mt-8">
        Betaling via Stripe. Opzeggen kan altijd via je account.
        Vragen?{' '}
        <a href="mailto:info@vastgoedai.nl" className="underline hover:text-foreground transition-colors">
          info@vastgoedai.nl
        </a>
      </p>
    </div>
  );
}
