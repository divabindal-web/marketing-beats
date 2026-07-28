'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Sun, Moon, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
    // If already logged in, redirect
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.push('/design-ops/dashboard');
      }
    });
  }, [router]);

  const handleSignIn = async () => {
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) {
        setError(authError.message);
      } else {
        router.push('/design-ops/dashboard');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSignIn();
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ backgroundColor: 'var(--bg-tertiary)' }}
    >
      {/* Theme toggle */}
      {mounted && (
        <button
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          className="gb-icon-btn absolute top-6 right-6"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
          }}
          aria-label="Toggle theme"
        >
          {theme === 'light' ? <Moon size={15} strokeWidth={1.75} /> : <Sun size={15} strokeWidth={1.75} />}
        </button>
      )}

      {/* Login card */}
      <div className="w-full max-w-[420px]">
        <div
          className="gb-card"
          style={{
            padding: '40px 36px',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {/* Brand */}
          <div className="text-center mb-8">
            <div
              className="w-11 h-11 mx-auto mb-4 rounded-lg flex items-center justify-center font-semibold text-[18px]"
              style={{
                backgroundColor: 'var(--accent-light)',
                color: 'var(--accent-text)',
                border: '1px solid var(--border)',
              }}
            >
              M
            </div>
            <h1
              className="text-[22px] font-semibold tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              Sign in to Marketing Beats
            </h1>
            <p className="text-[13px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
              Square Yards · Design Operations
            </p>
          </div>

          {/* Error */}
          {error && (
            <div
              className="mb-4 p-3 rounded-md text-[13px]"
              style={{
                backgroundColor: 'var(--error-bg)',
                color: 'var(--error)',
                border: '1px solid rgba(220, 38, 38, 0.2)',
              }}
            >
              {error}
            </div>
          )}

          {/* Email */}
          <div className="mb-4">
            <label
              className="block text-[12px] font-medium mb-1.5"
              style={{ color: 'var(--text-secondary)' }}
            >
              Work email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="you@squareyards.com"
              className="gb-input"
              disabled={loading}
            />
          </div>

          {/* Password */}
          <div className="mb-5">
            <label
              className="block text-[12px] font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="••••••••"
              className="gb-input mt-1.5"
              disabled={loading}
            />
          </div>

          {/* Sign in button */}
          <button
            onClick={handleSignIn}
            disabled={loading}
            className="gb-btn gb-btn-primary w-full"
            style={{ padding: '10px 14px', fontSize: 14, opacity: loading ? 0.7 : 1 }}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? 'Signing in…' : 'Continue'}
          </button>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-[12px]" style={{ color: 'var(--text-faint)' }}>
          Marketing Beats by Square Yards · v2.0
        </div>
      </div>
    </div>
  );
}
