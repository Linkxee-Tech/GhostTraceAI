'use client';

import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { login } from '@/lib/api';
import { persistSession } from '@/lib/authSession';
import { ShieldCheck, Eye, EyeOff } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [showPass, setShowPass]   = useState(false);

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
      if (user.role !== 'admin') {
        throw new Error('Not an admin');
      }
      persistSession(token, user);
      router.push('/mfa-verify');
    } catch {
      setError('Invalid admin credentials. Access denied.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>GhostTrace AI — Admin Portal</title>
      </Head>

      <div className="min-h-screen bg-gt-bg flex items-center justify-center px-4 relative overflow-hidden">
        {/* Background grid pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,229,160,0.06)_0%,transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.01)_0px,rgba(255,255,255,0.01)_1px,transparent_1px,transparent_60px),repeating-linear-gradient(rgba(255,255,255,0.01)_0px,rgba(255,255,255,0.01)_1px,transparent_1px,transparent_60px)] pointer-events-none" />

        <div className="relative w-full max-w-sm">
          {/* Header */}
          <div className="flex flex-col items-center gap-3 mb-8">
             <div className="w-24 h-24 rounded-2xl overflow-hidden border border-[rgba(255,255,255,0.12)] bg-gt-surface2">
              <img
                src="/ghosttrace_logo.png"
                alt="GhostTrace logo"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-extrabold font-display text-gt-text">Admin Portal</h1>
              <p className="text-[11px] font-mono text-gt-danger tracking-widest uppercase mt-0.5">
                Restricted Access — Authorized Personnel Only
              </p>
            </div>
          </div>

          {/* Warning banner */}
          <div className="mb-4 px-4 py-2.5 bg-gt-danger/5 border border-gt-danger/20 rounded-lg flex items-center gap-2">
            <ShieldCheck size={14} className="text-gt-danger flex-shrink-0" />
            <span className="text-[11px] font-mono text-gt-danger">
              All admin actions are logged and monitored.
            </span>
          </div>

          <div className="bg-gt-surface border border-[rgba(255,255,255,0.08)] rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gt-text mb-4">
              Administrator Sign In
            </h2>

            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="admin-email" className="text-[11px] font-mono text-gt-muted uppercase tracking-wider">
                  Admin Email
                </label>
                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@ghosttrace.ai"
                  autoComplete="email"
                  className="bg-gt-surface2 border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2.5 text-[13px] font-mono text-gt-text placeholder:text-gt-dim focus:outline-none focus:border-gt-danger/50 transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="admin-password" className="text-[11px] font-mono text-gt-muted uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="admin-password"
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full bg-gt-surface2 border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2.5 pr-10 text-[13px] font-mono text-gt-text placeholder:text-gt-dim focus:outline-none focus:border-gt-danger/50 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gt-muted hover:text-gt-text"
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-[11px] font-mono text-gt-danger bg-gt-danger/10 border border-gt-danger/20 rounded px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-gt-danger text-white font-mono font-bold text-sm rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-wait"
              >
                {loading ? 'Authenticating…' : 'Access Admin Panel'}
              </button>
            </form>

            <div className="flex items-center justify-between gap-2 mt-4 text-[11px] font-mono">
              <button
                type="button"
                onClick={() => router.push('/forgot-password')}
                className="text-gt-muted hover:text-gt-text"
              >
                Forgot password?
              </button>
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="text-gt-muted hover:text-gt-text"
              >
                ← User login
              </button>
            </div>
          </div>

          <p className="text-center text-[10px] font-mono text-gt-dim mt-4">
            GhostTrace AI v1.0.0 · Admin Access Portal
          </p>
        </div>
      </div>
    </>
  );
}
