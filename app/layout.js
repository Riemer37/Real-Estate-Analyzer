import { ClerkProvider } from '@clerk/nextjs';
import AppHeader from '@/components/AppHeader';
import './globals.css';

export const metadata = {
  title: 'VastgoedAI — Investeringsanalyse',
  description: 'Vastgoed investment calculator voor particuliere beleggers',
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="nl">
        <body>
          <AppHeader />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
