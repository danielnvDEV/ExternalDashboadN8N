import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import { Providers } from '@/components/providers';
import { Shell } from '@/components/layout/shell';
import './globals.css';

export const metadata: Metadata = {
  title: 'n8n Dashboard',
  description: 'Single-pane management for your n8n instance via the public REST API',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Providers>
            <Shell>{children}</Shell>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
