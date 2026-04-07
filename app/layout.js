import './globals.css';

export const metadata = {
  title: 'Vastgoed Platform',
  description: 'Real estate investment analyzer',
};

export default function RootLayout({ children }) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
