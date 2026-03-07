import { Metadata } from 'next';
import { IBM_Plex_Sans_Thai } from 'next/font/google';
import './globals.css';

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  subsets: ['latin', 'thai'],
  weight: ['100', '200', '300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-ibm-plex-sans-thai',
});

export const metadata: Metadata = {
  title: 'WHO KNOW?',
  description: 'Real-time Insider Game Controller',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${ibmPlexSansThai.variable} font-sans antialiased min-h-screen`}>
        {children}
      </body>
    </html>
  );

}
