'use client';

import Link from 'next/link';
import { Lock, Sparkles } from 'lucide-react';
import { useUser, SignInButton } from '@clerk/nextjs';

interface ProGateProps {
  feature?: string;
  description?: string;
}

export default function ProGate({
  feature = 'Deze feature',
  description = 'Upgrade naar Pro voor toegang tot AI analyse, onbeperkt opslaan en meer.',
}: ProGateProps) {
  const { isSignedIn, isLoaded } = useUser();

  return (
    <div className="flex items-center justify-center py-8">
      <div className="panel p-8 text-center space-y-5 max-w-sm w-full">
        <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Lock className="size-5 text-primary" />
        </div>

        <div>
          <div className="font-bold text-navy text-lg">{feature} — Pro</div>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{description}</p>
        </div>

        <div className="space-y-2">
          <Link
            href="/pricing"
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-navy text-white text-sm font-semibold rounded-md hover:opacity-90 transition-opacity w-full"
          >
            <Sparkles className="size-4" />
            Bekijk Pro — €19/mnd
          </Link>

          {isLoaded && !isSignedIn && (
            <SignInButton mode="modal">
              <button
                type="button"
                className="w-full px-5 py-2.5 border border-border rounded-md text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                Ik heb al een account — Inloggen
              </button>
            </SignInButton>
          )}
        </div>
      </div>
    </div>
  );
}
