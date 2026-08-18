'use client';
import AppLayout from '@/components/layout/AppLayout';

export default function OverviewLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout title="Overview">{children}</AppLayout>;
}
