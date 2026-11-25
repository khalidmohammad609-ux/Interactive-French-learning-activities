import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = { title: 'French activities · RRU', manifest: '/teacher.webmanifest', icons: { icon: '/icon-192.png', apple: '/icon-192.png' } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#c2410c' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#fff8f1', color: '#2b1a14', font: '17px/1.5 "Atkinson Hyperlegible","Segoe UI",system-ui,sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
