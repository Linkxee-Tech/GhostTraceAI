'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { Panel, PanelHeader, Badge, EmptyState, Spinner } from '@/components/shared/ui';
import { fetchUsers, createUserAccount, revokeUserSession, updateUserAccount } from '@/lib/api';
import type { UserAccount } from '@/lib/types';
import { formatRelativeTime } from '@/lib/utils';
import { UserPlus, KeyRound, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function UsersPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'analyst' | 'auditor' | 'viewer'>('analyst');
  const { data, isLoading, mutate } = useSWR('users', fetchUsers, {
    refreshInterval: 10000,
    revalidateOnFocus: false,
  });

  const users = data?.data ?? [];
  const [creating, setCreating] = useState(false);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreating(true);
      await createUserAccount({ email, password, name, role });
      setEmail('');
      setName('');
      setPassword('');
      setRole('analyst');
      toast.success('User account created');
      await mutate();
    } catch (err) {
      toast.error((err as any)?.response?.data?.error || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeSession = async (userId: string, sessionId: string) => {
    try {
      await revokeUserSession(userId, sessionId);
      toast.success('Session revoked');
      await mutate();
    } catch {
      toast.error('Failed to revoke session');
    }
  };

  const handleRoleChange = async (userId: string, nextRole: UserAccount['role']) => {
    try {
      await updateUserAccount(userId, { role: nextRole });
      toast.success('User role updated');
      await mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to update role');
    }
  };

  const handleStatusToggle = async (userId: string, status: UserAccount['status']) => {
    try {
      const next = status === 'active' ? 'disabled' : 'active';
      await updateUserAccount(userId, { status: next });
      toast.success(`User ${next}`);
      await mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to update status');
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Panel>
        <PanelHeader title="User Management" action="Admin only" />
        <div className="p-5 grid gap-5 md:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-[11px] font-mono text-gt-muted mb-3">Create a new user account with a secure password and role-based access.</p>
            <form onSubmit={handleCreateUser} className="grid gap-3">
              <label className="text-[11px] font-mono text-gt-muted">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-gt-surface2 border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2.5 text-sm text-gt-text"
              />
              <label className="text-[11px] font-mono text-gt-muted">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-gt-surface2 border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2.5 text-sm text-gt-text"
              />
              <label className="text-[11px] font-mono text-gt-muted">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full bg-gt-surface2 border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2.5 text-sm text-gt-text"
              />
              <label className="text-[11px] font-mono text-gt-muted">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full bg-gt-surface2 border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2.5 text-sm text-gt-text"
              >
                <option value="admin">Admin</option>
                <option value="analyst">Analyst</option>
                <option value="auditor">Auditor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                type="submit"
                disabled={creating}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gt-accent text-gt-bg font-semibold text-sm hover:opacity-90 disabled:opacity-50"
              >
                <UserPlus size={16} />
                Create user
              </button>
            </form>
          </div>

          <div className="rounded-2xl bg-gt-surface2 p-4 border border-[rgba(255,255,255,0.06)]">
            <p className="text-[11px] font-mono text-gt-muted mb-3">Use the API or the admin console to manage role-based accounts and session access.</p>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <KeyRound size={18} className="text-gt-accent" />
                <div>
                  <p className="text-sm font-semibold text-gt-text">Password-based sign in</p>
                  <p className="text-[11px] text-gt-muted">Users authenticate using email and password with secure session tracking.</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <XCircle size={18} className="text-gt-warn" />
                <div>
                  <p className="text-sm font-semibold text-gt-text">Audit trails</p>
                  <p className="text-[11px] text-gt-muted">All user actions and session revocations are stored for compliance.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Accounts" action={isLoading ? 'Loading…' : `${users.length} users`} />
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : users.length === 0 ? (
          <EmptyState message="No users available" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-gt-muted">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.08)]">
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last login</th>
                  <th className="px-4 py-3">Active sessions</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.userId} className="border-b border-[rgba(255,255,255,0.05)] hover:bg-gt-surface2 transition-colors">
                    <td className="px-4 py-3 text-gt-text">{user.email}</td>
                    <td className="px-4 py-3">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.userId, e.target.value as UserAccount['role'])}
                        className="bg-gt-surface2 border border-[rgba(255,255,255,0.1)] rounded px-2 py-1 text-xs text-gt-text"
                      >
                        <option value="admin">admin</option>
                        <option value="analyst">analyst</option>
                        <option value="auditor">auditor</option>
                        <option value="viewer">viewer</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={user.status === 'active' ? 'bg-gt-accent/10 text-gt-accent border-gt-accent/20' : 'bg-gt-warn/10 text-gt-warn border-gt-warn/20'}>
                        {user.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{user.lastLoginAt ? formatRelativeTime(user.lastLoginAt) : 'Never'}</td>
                    <td className="px-4 py-3">{user.sessionCount ?? 0}</td>
                    <td className="px-4 py-3 flex items-center gap-3">
                      {user.sessions?.map((session) => (
                        session.isActive ? (
                          <button
                            key={session.sessionId}
                            onClick={() => handleRevokeSession(user.userId, session.sessionId)}
                            className="text-[11px] font-mono text-gt-danger hover:underline"
                          >
                            Revoke session
                          </button>
                        ) : null
                      ))}
                      <button
                        onClick={() => handleStatusToggle(user.userId, user.status)}
                        className="text-[11px] font-mono text-gt-warn hover:underline"
                      >
                        {user.status === 'active' ? 'Disable user' : 'Enable user'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
