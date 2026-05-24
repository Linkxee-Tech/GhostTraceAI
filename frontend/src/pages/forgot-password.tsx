'use client';

import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { requestPasswordReset } from '@/lib/api';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await requestPasswordReset(email.trim());
      toast.success('If the account exists, reset instructions were sent');
      setTimeout(() => router.push('/login'), 1200);
    } catch {
      toast.error('Unable to request password reset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>GhostTrace AI — Reset Password</title>
      </Head>

      <div className="min-h-screen bg-gt-bg flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center gap-3 mb-8">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border border-[rgba(255,255,255,0.12)] bg-gt-surface2" />
            <div className="text-center">
              <h1 className="text-xl font-extrabold font-display text-gt-text">Forgot Password</h1>
              <p className="text-[11px] font-mono text-gt-accent tracking-widest uppercase mt-0.5">Enter your email to receive reset instructions.</p>
            </div>
          </div>

          <div className="bg-gt-surface border border-[rgba(255,255,255,0.08)] rounded-xl p-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-gt-accent text-gt-bg font-mono font-bold text-sm rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? 'Sending…' : 'Send reset email'}
              </button>
            </form>
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="mt-4 w-full text-[11px] font-mono text-gt-muted border border-[rgba(255,255,255,0.08)] rounded-lg py-2.5 hover:text-gt-text transition-colors"
            >
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
