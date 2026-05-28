'use client';

import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { login } from '@/lib/api';
import { persistSession } from '@/lib/authSession';

const DEMO_LOGIN_ENABLED = process.env.NEXT_PUBLIC_AUTH_DEMO_ENABLED === 'true' || process.env.NODE_ENV !== 'production';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Email and password are required');
      return;
    }

    setLoading(true);
    try {
      const { token, user } = await login(email.trim(), password);
      persistSession(token, user);
      router.push('/mfa-verify');
    } catch {
      setError('Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoMode = async () => {
    if (!DEMO_LOGIN_ENABLED) {
      setError('Demo login is disabled in production.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const { token, user } = await login('demo@ghosttrace.ai', 'demo');
      persistSession(token, user);
      router.push('/mfa-verify');
    } catch {
      setError('Demo login is currently unavailable. Please sign in normally.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>GhostTrace AI — Sign In</title>
      </Head>

      <div className="min-h-screen bg-gt-bg flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center gap-3 mb-8">
            <div className="w-24 h-24 rounded-2xl overflow-hidden border border-[rgba(255,255,255,0.12)] bg-gt-surface2">
              <img
                src="/ghosttrace_logo.png"
                alt="GhostTrace logo"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-extrabold font-display text-gt-text">GhostTrace AI</h1>
              <p className="text-[11px] font-mono text-gt-accent tracking-widest uppercase mt-0.5">
                Fraud Intelligence Platform
              </p>
            </div>
          </div>

          <div className="bg-gt-surface border border-[rgba(255,255,255,0.08)] rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gt-text mb-4">Sign in with email</h2>

            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-[11px] font-mono text-gt-muted uppercase tracking-wider">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="bg-gt-surface2 border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2.5 text-[13px] font-mono text-gt-text placeholder:text-gt-dim focus:outline-none focus:border-gt-accent/50 transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-[11px] font-mono text-gt-muted uppercase tracking-wider">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="bg-gt-surface2 border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2.5 text-[13px] font-mono text-gt-text placeholder:text-gt-dim focus:outline-none focus:border-gt-accent/50 transition-colors"
                />
              </div>

              {error && (
                <div className="text-[11px] font-mono text-gt-danger bg-gt-danger/10 border border-gt-danger/20 rounded px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-gt-accent text-gt-bg font-mono font-bold text-sm rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-wait"
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            <div className="flex items-center justify-between gap-2 mt-4 text-[11px] font-mono text-gt-dim">
              <button
                type="button"
                onClick={() => router.push('/forgot-password')}
                className="text-gt-accent hover:underline"
              >
                Forgot password?
              </button>
              <button
                type="button"
                onClick={handleDemoMode}
                className="text-gt-muted hover:text-gt-text"
              >
                Demo mode
              </button>
              <button
                type="button"
                onClick={() => router.push('/admin-login')}
                className="text-gt-muted hover:text-gt-danger transition-colors"
              >
                Admin login →
              </button>
            </div>
          </div>

          <p className="text-center text-[10px] font-mono text-gt-dim mt-4">
            Google Cloud Rapid Agent 2026
          </p>
        </div>
      </div>
    </>
  );
}
