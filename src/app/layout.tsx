import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/layout/ThemeProvider';

export const metadata: Metadata = {
  title: 'Marketing Beats - Square Yards',
  description: 'Design Operations & Marketing Management Tool',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem={false} storageKey="marketing-beats-theme">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
