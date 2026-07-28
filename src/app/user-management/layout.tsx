'use client';
import AppLayout from '@/components/layout/AppLayout';

export default function UserManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout title="User Management">{children}</AppLayout>;
}
