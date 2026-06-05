'use client';

import { useState } from 'react';
import { useUser, SignInButton } from '@clerk/nextjs';
import { Sparkles } from 'lucide-react';

export default function UpgradeButton() {
  const { user, isSignedIn, isLoaded } = useUser();
  const [loading, setLoading] = useState(false);
  const isPro = user?.publicMetadata?.isPro === true;

  if (isPro) {
    return (
      <div className="w-full text-center py-2.5 rounded-md bg-positive/10 border border-positive/20 text-positive text-sm font-semibold">
        ✓ Je bent al Pro
      </div>
    );
  }

  const handleCheckout = async (annual: boolean) => {
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ annual }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded) return null;

  if (!isSignedIn) {
    return (
      <SignInButton mode="modal" forceRedirectUrl="/pricing">
        <button
          type="button"
          className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-navy text-white text-sm font-semibold rounded-md hover:opacity-90 transition-opacity"
        >
          <Sparkles className="size-4" />
          Aanmelden &amp; Upgraden
        </button>
      </SignInButton>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => handleCheckout(false)}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-navy text-white text-sm font-semibold rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        <Sparkles className="size-4" />
        {loading ? 'Laden...' : 'Maandelijks — €19 / maand'}
      </button>
      <button
        type="button"
        onClick={() => handleCheckout(true)}
        disabled={loading}
        className="w-full px-5 py-2.5 border border-border rounded-md text-sm font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
      >
        Jaarlijks — €149 / jaar
        <span className="ml-1.5 text-positive font-semibold text-[11px]">−35%</span>
      </button>
    </div>
  );
}
