import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Yadban — Personal reminders',
  description: 'A bilingual home for installments, bills and everyday reminders.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/favicon.svg', apple: '/icon-192.png' },
  appleWebApp: { capable: true, title: 'Yadban', statusBarStyle: 'default' },
};
export const viewport: Viewport = { themeColor: '#20765d' };
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <body>{children}</body>
    </html>
  );
}
