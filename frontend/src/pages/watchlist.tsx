'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { Panel, PanelHeader, Badge, Spinner, EmptyState } from '@/components/shared/ui';
import { Search, Plus, Trash2, X } from 'lucide-react';
import { fetchWatchlist, addWatchlistEntity, deleteWatchlistEntity } from '@/lib/api';
import type { WatchlistEntity } from '@/lib/types';
import toast from 'react-hot-toast';

// Removed hard-coded demo watchlist; fetch from API instead

export default function WatchlistPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [entityType, setEntityType] = useState('IP Address');
  const [entityValue, setEntityValue] = useState('');
  const [entityReason, setEntityReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data, error, mutate } = useSWR('watchlist', () => fetchWatchlist().then((r) => r.data), { revalidateOnFocus: false, shouldRetryOnError: false });
  const watchlist = data || [];

  const filteredWatchlist = watchlist.filter(item => 
    (item.value || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (item.reason || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddEntity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityValue || !entityReason) return;
    setSubmitting(true);
    try {
      await addWatchlistEntity({ type: entityType, value: entityValue, reason: entityReason });
      toast.success('Entity added to watchlist');
      setIsModalOpen(false);
      setEntityValue('');
      setEntityReason('');
      mutate();
    } catch {
      toast.error('Failed to add entity');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteWatchlistEntity(id);
      toast.success('Entity removed from watchlist');
      mutate();
    } catch {
      toast.error('Failed to remove entity');
    }
  };

  return (
    <div className="max-w-6xl flex flex-col gap-6 relative">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-gt-text">Watchlist</h1>
          <p className="text-sm text-gt-muted">Monitor high-risk entities (IPs, Devices, Accounts).</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-gt-accent text-black font-semibold px-4 py-2 rounded hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          <span>Add Entity</span>
        </button>
      </div>

      <Panel>
        <PanelHeader 
          title="Watched Entities" 
          action={
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gt-muted" />
              <input 
                type="text" 
                placeholder="Search entities..." 
                className="bg-gt-surface2 border border-[rgba(255,255,255,0.1)] rounded pl-9 pr-3 py-1.5 focus:outline-none focus:border-gt-accent text-sm w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          }
        />
        {error ? (
          <div className="p-6"><EmptyState message="Unable to load watchlist — check backend connection." /></div>
        ) : !data ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.05)] text-gt-muted">
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Entity Value</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                  <th className="px-4 py-3 font-medium">Added By</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredWatchlist.map((item) => (
                  <tr key={item.entityId} className="border-b border-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                    <td className="px-4 py-3">
                      <Badge size="sm" className="border-[rgba(255,255,255,0.1)] text-gt-text">{item.type}</Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-gt-text">{item.value}</td>
                    <td className="px-4 py-3 text-gt-muted">{item.reason}</td>
                    <td className="px-4 py-3 text-gt-muted">{item.addedBy}</td>
                    <td className="px-4 py-3 text-right">
                      <button 
                        onClick={() => handleDelete(item.entityId)}
                        className="text-gt-muted hover:text-gt-danger p-1 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Add Entity Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gt-surface border border-[rgba(255,255,255,0.1)] rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-slide-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(255,255,255,0.05)]">
              <h2 className="text-lg font-bold text-gt-text">Add to Watchlist</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gt-muted hover:text-gt-text">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddEntity} className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-mono text-gt-muted uppercase tracking-wider">Entity Type</label>
                <select
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value)}
                  className="bg-gt-surface2 border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2.5 text-sm text-gt-text focus:outline-none focus:border-gt-accent"
                >
                  <option value="IP Address">IP Address</option>
                  <option value="Account">Account</option>
                  <option value="Device Hash">Device Hash</option>
                  <option value="Email">Email</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-mono text-gt-muted uppercase tracking-wider">Value</label>
                <input
                  type="text"
                  required
                  value={entityValue}
                  onChange={(e) => setEntityValue(e.target.value)}
                  placeholder="e.g. 192.168.1.105"
                  className="bg-gt-surface2 border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2.5 text-sm font-mono text-gt-text focus:outline-none focus:border-gt-accent"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-mono text-gt-muted uppercase tracking-wider">Reason</label>
                <input
                  type="text"
                  required
                  value={entityReason}
                  onChange={(e) => setEntityReason(e.target.value)}
                  placeholder="e.g. Known proxy node"
                  className="bg-gt-surface2 border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2.5 text-sm text-gt-text focus:outline-none focus:border-gt-accent"
                />
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-gt-muted hover:text-gt-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-bold bg-gt-accent text-black rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {submitting ? 'Adding...' : 'Add Entity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
