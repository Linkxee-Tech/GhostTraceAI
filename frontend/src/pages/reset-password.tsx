'use client';

import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { completePasswordReset } from '@/lib/api';
import toast from 'react-hot-toast';

export default function ResetPasswordPage() {
  const router = useRouter();
  const { token } = router.query;
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [invalidToken, setInvalidToken] = useState(false);

  useEffect(() => {
    if (token && typeof token !== 'string') {
      setInvalidToken(true);
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || typeof token !== 'string') {
      setInvalidToken(true);
      return;
    }
    setLoading(true);
    try {
      await completePasswordReset(token, password);
      toast.success('Password reset successfully');
      router.push('/login');
    } catch {
      toast.error('Reset token is invalid or expired');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>GhostTrace AI — Set New Password</title>
      </Head>

      <div className="min-h-screen bg-gt-bg flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center gap-3 mb-8">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border border-[rgba(255,255,255,0.12)] bg-gt-surface2" />
            <div className="text-center">
              <h1 className="text-xl font-extrabold font-display text-gt-text">Reset Password</h1>
              <p className="text-[11px] font-mono text-gt-accent tracking-widest uppercase mt-0.5">Set a new password for your account.</p>
            </div>
          </div>

          <div className="bg-gt-surface border border-[rgba(255,255,255,0.08)] rounded-xl p-6">
            {invalidToken ? (
              <div className="text-[12px] font-mono text-gt-danger">
                Invalid reset token. Please request a new password reset.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <label htmlFor="password" className="text-[11px] font-mono text-gt-muted uppercase tracking-wider">
                  New password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={8}
                  className="bg-gt-surface2 border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2.5 text-[13px] font-mono text-gt-text placeholder:text-gt-dim focus:outline-none focus:border-gt-accent/50 transition-colors"
                />
                <button
                  type="submit"
                  disabled={loading || !password}
                  className="w-full py-2.5 bg-gt-accent text-gt-bg font-mono font-bold text-sm rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading ? 'Updating…' : 'Update password'}
                </button>
              </form>
            )}
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
