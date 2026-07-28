'use client';
import AppLayout from '@/components/layout/AppLayout';
import { usePathname } from 'next/navigation';

const pageTitles: Record<string, string> = {
  '/design-ops/dashboard': 'Dashboard',
  '/design-ops/requests': 'All Requests',
  '/design-ops/downloads': 'Downloads / Uploads',
};

export default function DesignOpsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const title = pageTitles[pathname] || 'Design Ops';

  return (
    <AppLayout title={title}>
      {children}
    </AppLayout>
  );
}
