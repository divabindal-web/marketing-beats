'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { RoleProvider } from './RoleContext';
import { CurrentUserProvider } from './CurrentUserContext';
import { supabase } from '@/lib/supabase';

interface AppLayoutProps {
  children: React.ReactNode;
  title: string;
}

export default function AppLayout({ children, title }: AppLayoutProps) {
  const router = useRouter();
  // null = checking, false = not signed in (redirecting), true = signed in
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) {
        setAuthed(true);
      } else {
        setAuthed(false);
        router.replace('/auth/login');
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session) {
        setAuthed(false);
        router.replace('/auth/login');
      } else {
        setAuthed(true);
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  if (authed !== true) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-faint)' }}
      >
        <div className="text-[13px]">Checking sign-in…</div>
      </div>
    );
  }

  return (
    <CurrentUserProvider>
      <RoleProvider>
        <div className="flex min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
          <Sidebar />

          <div className="flex-1 flex flex-col ml-64">
            {/* No onNewRequest prop → Topbar uses its own global modal that saves to the DB */}
            <Topbar title={title} />

            <main className="flex-1 mt-14">
              <div className="max-w-[1200px] mx-auto px-10 py-10">
                {children}
              </div>
            </main>
          </div>
        </div>
      </RoleProvider>
    </CurrentUserProvider>
  );
}
