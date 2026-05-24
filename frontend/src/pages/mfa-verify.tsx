'use client';

import React, { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';

import { verifyMFA } from '@/lib/api';

export default function MFAVerifyPage() {
  const router = useRouter();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (inputRefs.current[0]) inputRefs.current[0].focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = code.join('');
    if (fullCode.length < 6) {
      toast.error('Please enter the 6-digit code');
      return;
    }

    setLoading(true);
    try {
      const { token } = await verifyMFA(fullCode);
      localStorage.setItem('gt_token', token);
      toast.success('Authentication successful');
      router.push('/');
    } catch {
      toast.error('Invalid authentication code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>GhostTrace AI — Two-Factor Authentication</title>
      </Head>

      <div className="min-h-screen bg-gt-bg flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center gap-3 mb-8">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border border-[rgba(255,255,255,0.12)] bg-gt-surface2">
              <img src="/ghosttrace_logo.png" alt="GhostTrace Logo" className="w-full h-full object-cover" />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-extrabold font-display text-gt-text">Two-Factor Auth</h1>
              <p className="text-[11px] font-mono text-gt-accent tracking-widest uppercase mt-0.5">Enter code from your authenticator</p>
            </div>
          </div>

          <div className="bg-gt-surface border border-[rgba(255,255,255,0.08)] rounded-xl p-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <div className="flex justify-between gap-2">
                {code.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    className="w-12 h-14 bg-gt-surface2 border border-[rgba(255,255,255,0.1)] rounded-lg text-center text-lg font-mono text-gt-text focus:outline-none focus:border-gt-accent/50 transition-colors"
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-gt-accent text-gt-bg font-mono font-bold text-sm rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? 'Verifying…' : 'Verify Code'}
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
