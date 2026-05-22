'use client';

import React from 'react';
import { useStore } from '@/lib/store';

export default function NotFound() {
  const { setActiveTab } = useStore();

  return (
    <div className="min-h-screen bg-gt-bg flex items-center justify-center px-6">
      <div className="text-center">
        <div className="text-[80px] font-extrabold font-display text-gt-dim leading-none mb-4">
          404
        </div>
        <h1 className="text-xl font-bold text-gt-text mb-2">Page not found</h1>
        <p className="text-gt-muted font-mono text-sm mb-8">
          The route you requested does not exist.
        </p>
        <button
          onClick={() => { window.location.href = '/'; }}
          className="px-6 py-2.5 bg-gt-accent text-gt-bg font-mono font-bold text-sm rounded-lg hover:opacity-90 transition-opacity"
        >
          ← Back to Dashboard
        </button>
      </div>
    </div>
  );
}
