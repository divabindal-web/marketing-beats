'use client';
import AppLayout from '@/components/layout/AppLayout';
import { usePathname } from 'next/navigation';

const pageTitles: Record<string, string> = {
  '/user-management': 'User Management',
  '/admin/reset-passwords': 'Reset Passwords',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const title = pageTitles[pathname] || 'Admin';
  return <AppLayout title={title}>{children}</AppLayout>;
}
