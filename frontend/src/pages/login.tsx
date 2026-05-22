'use client';

import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function LoginPage() {
  const router = useRouter();
  const [apiKey, setApiKey]     = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!apiKey.trim()) {
      setError('API key is required');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/auth/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey }),
        }
      );

      if (!res.ok) {
        setError('Invalid API key. Check your credentials.');
        return;
      }

      const json = await res.json();
      const token = json?.data?.token;
      if (!token) {
        setError('Login response missing token');
        return;
      }
      localStorage.setItem('gt_token', token);
      router.push('/');
    } catch {
      setError('Cannot connect to backend. Starting in demo mode.');
      // Allow demo mode without a token
      setTimeout(() => router.push('/'), 1200);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoMode = () => {
    localStorage.removeItem('gt_token');
    router.push('/');
  };

  return (
    <>
      <Head>
        <title>GhostTrace AI — Sign In</title>
      </Head>

      <div className="min-h-screen bg-gt-bg flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="flex flex-col items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-gt-accent rounded-xl flex items-center justify-center relative overflow-hidden">
              <div
                className="absolute inset-0"
                style={{ background: 'repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(0,0,0,.15) 3px,rgba(0,0,0,.15) 6px)' }}
              />
              <svg width="24" height="24" viewBox="0 0 18 18" fill="none" style={{ position: 'relative', zIndex: 1 }}>
                <path d="M9 1L2 5v8l7 4 7-4V5L9 1z" stroke="#0a0c0f" strokeWidth="1.5" fill="none" />
                <circle cx="9" cy="9" r="2.5" fill="#0a0c0f" />
                <path d="M9 4v2M9 12v2M4 9h2M12 9h2" stroke="#0a0c0f" strokeWidth="1.5" />
              </svg>
            </div>
            <div className="text-center">
              <h1 className="text-xl font-extrabold font-display text-gt-text">GhostTrace AI</h1>
              <p className="text-[11px] font-mono text-gt-accent tracking-widest uppercase mt-0.5">
                Fraud Intelligence Platform
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="bg-gt-surface border border-[rgba(255,255,255,0.08)] rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gt-text mb-4">Sign in with API Key</h2>

            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="api-key" className="text-[11px] font-mono text-gt-muted uppercase tracking-wider">
                  API Key
                </label>
                <input
                  id="api-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="gt_••••••••••••••••"
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
                {loading ? 'Connecting…' : 'Sign In'}
              </button>
            </form>

            <div className="flex items-center gap-3 my-4">
              <div className="h-px flex-1 bg-[rgba(255,255,255,0.06)]" />
              <span className="text-[10px] font-mono text-gt-dim">OR</span>
              <div className="h-px flex-1 bg-[rgba(255,255,255,0.06)]" />
            </div>

            <button
              onClick={handleDemoMode}
              className="w-full py-2.5 text-sm font-mono text-gt-muted border border-[rgba(255,255,255,0.08)] rounded-lg hover:text-gt-text hover:border-[rgba(255,255,255,0.16)] transition-colors"
            >
              Continue in Demo Mode
            </button>
          </div>

          <p className="text-center text-[10px] font-mono text-gt-dim mt-4">
            Google Cloud Rapid Agent Hackathon 2026
          </p>
        </div>
      </div>
    </>
  );
}
