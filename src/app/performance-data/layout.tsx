'use client';
import AppLayout from '@/components/layout/AppLayout';
import { usePathname } from 'next/navigation';

const pageTitles: Record<string, string> = {
  '/performance-data/seo': 'SEO Performance',
  '/performance-data/orm': 'ORM — Online Reputation',
  '/performance-data/paid': 'Paid Campaigns',
  '/performance-data/social': 'Social — Hootsuite',
};

export default function PerformanceDataLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const title = pageTitles[pathname] || 'Performance Data';
  return <AppLayout title={title}>{children}</AppLayout>;
}
