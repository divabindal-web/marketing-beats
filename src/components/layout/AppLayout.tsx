'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { RoleProvider } from './RoleContext';
import { CurrentUserProvider } from './CurrentUserContext';
import { ViewAsProvider, useViewAs } from './ViewAsContext';
import { supabase } from '@/lib/supabase';

function ViewAsBanner() {
  const { target, setTarget } = useViewAs();
  if (!target) return null;
  return (
    <div
      className="flex items-center justify-center gap-3 px-4 py-2 text-[12.5px] font-medium mb-fade-in"
      style={{ backgroundColor: 'var(--accent)', color: 'var(--on-accent)' }}
    >
      <span>
        Viewing as <strong>{target.name}</strong>
        {target.team ? ` · ${target.team}` : ''}
      </span>
      <button
        onClick={() => setTarget(null)}
        className="px-2 py-0.5 rounded text-[11px] font-semibold transition-transform active:scale-95"
        style={{ backgroundColor: 'rgba(0,0,0,0.14)' }}
      >
        Exit
      </button>
    </div>
  );
}

interface AppLayoutProps {
  children: React.ReactNode;
  title: string;
}

export default function AppLayout({ children, title }: AppLayoutProps) {
  const router = useRouter();
  // Below lg the sidebar is off-canvas; the topbar's menu button slides it in.
  const [navOpen, setNavOpen] = useState(false);
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
        <ViewAsProvider>
          <div className="flex min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
            {/* Scrim for the off-canvas nav on small screens */}
            {navOpen && (
              <div
                className="fixed inset-0 z-[35] lg:hidden"
                style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
                onClick={() => setNavOpen(false)}
              />
            )}
            <Sidebar open={navOpen} onNavigate={() => setNavOpen(false)} />

            <div className="flex-1 flex flex-col lg:ml-64 min-w-0">
              <Topbar title={title} onOpenNav={() => setNavOpen(true)} />

              <main className="flex-1 mt-14">
                <ViewAsBanner />
                <div className="max-w-[1200px] mx-auto px-5 md:px-10 py-8 md:py-10 mb-animate-in">
                  {children}
                </div>
              </main>
            </div>
          </div>
        </ViewAsProvider>
      </RoleProvider>
    </CurrentUserProvider>
  );
}
