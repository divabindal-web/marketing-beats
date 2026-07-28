'use client';
import AppLayout from '@/components/layout/AppLayout';
import { usePathname } from 'next/navigation';

const pageTitles: Record<string, string> = {
  '/performance/my': 'My Performance',
  '/performance/team': 'Team Performance',
  '/performance/change-requests': 'Change Requests',
};

export default function PerformanceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const title = pageTitles[pathname] || 'Performance';

  return <AppLayout title={title}>{children}</AppLayout>;
}
