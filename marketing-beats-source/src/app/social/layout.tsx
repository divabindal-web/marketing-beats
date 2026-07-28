'use client';
import AppLayout from '@/components/layout/AppLayout';
import { usePathname } from 'next/navigation';

const pageTitles: Record<string, string> = {
  '/social/dashboard': 'Social Dashboard',
  '/social/upload': 'Upload Metrics',
  '/social/calendar': 'Social Calendar',
  '/social/how-to-fetch': 'How to Fetch Data',
};

export default function SocialLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const title = pageTitles[pathname] || 'Social';
  return <AppLayout title={title}>{children}</AppLayout>;
}
