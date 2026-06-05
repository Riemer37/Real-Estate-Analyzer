'use client';

import Link from 'next/link';
import { useUser, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';
import { Sparkles, Home } from 'lucide-react';

export default function AppHeader() {
  const { user, isSignedIn, isLoaded } = useUser();
  const isPro = user?.publicMetadata?.isPro === true;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between gap-4">

        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 font-extrabold text-navy text-sm">
          <Home className="size-4" />
          VastgoedAI
        </Link>

        {/* Nav + Auth */}
        <div className="flex items-center gap-3">
          <Link
            href="/pricing"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
          >
            Prijzen
          </Link>

          {isLoaded && (
            <>
              {isSignedIn ? (
                <div className="flex items-center gap-2">
                  {isPro ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold border border-primary/20">
                      <Sparkles className="size-2.5" />
                      Pro
                    </span>
                  ) : (
                    <Link
                      href="/pricing"
                      className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
                    >
                      <Sparkles className="size-3" />
                      Upgrade
                    </Link>
                  )}
                  <UserButton />
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <SignInButton mode="modal">
                    <button
                      type="button"
                      className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
                    >
                      Inloggen
                    </button>
                  </SignInButton>
                  <SignUpButton mode="modal" forceRedirectUrl="/pricing">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-navy text-white text-sm font-semibold rounded-md hover:opacity-90 transition-opacity"
                    >
                      <Sparkles className="size-3.5" />
                      <span className="hidden sm:inline">Upgrade naar Pro</span>
                      <span className="sm:hidden">Pro</span>
                    </button>
                  </SignUpButton>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
