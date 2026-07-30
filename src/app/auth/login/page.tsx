'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Sun, Moon, Loader2, Eye, EyeOff } from 'lucide-react';
import { supabase, REMEMBER_KEY } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
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
    // Record the choice BEFORE signing in so the auth token lands in the right storage
    window.localStorage.setItem(REMEMBER_KEY, keepSignedIn ? 'yes' : 'no');
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
          className="gb-card mb-scale-in"
          style={{
            padding: '40px 36px',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {/* Brand */}
          <div className="text-center mb-8">
            <div
              className="w-12 h-12 mx-auto mb-4 rounded-xl flex items-center justify-center font-bold text-[20px] mb-brand-gradient mb-pop"
              style={{ boxShadow: '0 6px 18px -3px rgba(234, 194, 0, 0.55)' }}
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
              placeholder="you@squareyards.in"
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
            <div className="relative mt-1.5">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="••••••••"
                className="gb-input pr-10"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-faint)' }}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
              </button>
            </div>
          </div>

          {/* Keep me signed in */}
          <label
            className="flex items-center gap-2 mb-5 cursor-pointer select-none"
            style={{ fontSize: '13px', color: 'var(--text-secondary)' }}
          >
            <input
              type="checkbox"
              checked={keepSignedIn}
              onChange={(e) => setKeepSignedIn(e.target.checked)}
              style={{ width: '15px', height: '15px', accentColor: 'var(--accent)', cursor: 'pointer' }}
              disabled={loading}
            />
            Keep this device logged in
          </label>

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
