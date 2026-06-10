import type { Metadata } from 'next';
import { Instrument_Serif, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const instrumentSerif = Instrument_Serif({
  weight: ['400'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-instrument-serif',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  weight: ['400', '500', '600'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://smarttips-ashen.vercel.app'),
  title: {
    template: '%s | SmartTips',
    default: 'SmartTips — Distribution équitable des pourboires',
  },
  description:
    'SmartTips est un logiciel SaaS de gestion et distribution automatique des pourboires pour restaurants et franchises, propulsé par le machine learning. Gérez vos shifts, équipes, commandes et obtenez une répartition transparente, équitable et conforme.',
  keywords: [
    'restaurant tips',
    'tip distribution',
    'tip management',
    'restaurant SaaS',
    'pourboires',
    'distribution pourboires',
    'gestion pourboires restaurant',
    'tip pool',
    'répartition pourboires',
    'logiciel restaurant',
    'franchise restauration',
  ],
  authors: [{ name: 'SmartTips' }],
  creator: 'SmartTips',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  openGraph: {
    title: 'SmartTips — Distribution équitable des pourboires',
    description:
      'Logiciel SaaS de gestion des pourboires pour restaurants et franchises. ML-powered, transparent, équitable.',
    url: 'https://smarttips-ashen.vercel.app',
    siteName: 'SmartTips',
    locale: 'fr_CA',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SmartTips — Distribution ML des pourboires',
    description:
      'Distribuez les pourboires de votre restaurant équitablement grâce au machine learning. Solution SaaS multi-tenant pour restaurants et franchises.',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      data-theme="dark"
      className={`${instrumentSerif.variable} ${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/*
          Synchronous theme initializer — must run before paint to avoid FOUC.
          Static file in /public, no user input, no dynamic interpolation.
          The Next.js rule against sync scripts is intentionally overridden here:
          deferring this script would cause a visible colour flash on every load.
        */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/theme-init.js" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
