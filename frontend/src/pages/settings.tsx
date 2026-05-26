'use client';

import React, { useState, useEffect } from 'react';
import { Panel, Badge } from '@/components/shared/ui';
import { Settings, Bell, ShieldCheck, Link2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchSettings, saveSettings, generateApiKey, revokeApiKey, testWebhook, fetchWebhookTestLogs } from '@/lib/api';
import type { GeneralSettings } from '@/lib/types';
import { formatRelativeTime } from '@/lib/utils';

const TABS = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'integrations', label: 'Integrations', icon: Link2 },
  { id: 'security', label: 'Security & API', icon: ShieldCheck },
  { id: 'notifications', label: 'Notifications', icon: Bell },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const [orgName, setOrgName] = useState('GhostTrace Global');
  const [supportEmail, setSupportEmail] = useState('soc@ghosttrace.ai');
  const [timezone, setTimezone] = useState('UTC');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [mfaRequired, setMfaRequired] = useState(true);
  const [apiKeyName, setApiKeyName] = useState('Production Ingestion');
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<NonNullable<GeneralSettings['apiKeys']>>([]);
  const [webhookLogs, setWebhookLogs] = useState<NonNullable<GeneralSettings['webhookTestLogs']>>([]);

  const syncSettings = async () => {
    const s = await fetchSettings();
    setOrgName(s.orgName || 'GhostTrace Global');
    setSupportEmail(s.supportEmail || 'soc@ghosttrace.ai');
    setWebhookUrl(s.webhookUrl || '');
    setMfaRequired(Boolean(s.mfaRequired ?? true));
    setApiKeys(s.apiKeys || []);
    setWebhookLogs(s.webhookTestLogs || []);
  };

  useEffect(() => {
    let mounted = true;
    setSettingsLoading(true);
    setSettingsError(null);

    syncSettings()
      .catch((err: any) => {
        if (!mounted) return;
        setSettingsError(err?.response?.data?.error || err?.message || 'Failed to load settings');
      })
      .finally(() => {
        if (mounted) setSettingsLoading(false);
      });

    return () => { mounted = false; };
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setSettingsError(null);
    try {
      await saveSettings({ orgName, supportEmail, webhookUrl, mfaRequired });
      await syncSettings();
      toast.success('Settings saved successfully');
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to save settings';
      setSettingsError(msg);
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateApiKey = async () => {
    try {
      const name = apiKeyName.trim();
      if (!name) {
        toast.error('Enter a key name first');
        return;
      }
      const { key } = await generateApiKey(name);
      setNewApiKey(key);
      await syncSettings();
      toast.success('API key generated. Copy it now.');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to generate API key');
    }
  };

  const handleWebhookTest = async () => {
    try {
      if (!webhookUrl.trim()) {
        toast.error('Enter a webhook URL first');
        return;
      }
      const result = await testWebhook(webhookUrl.trim());
      const logs = await fetchWebhookTestLogs();
      setWebhookLogs(logs || []);
      if (result.success) {
        toast.success(`Webhook responded with status ${result.statusCode}`);
      } else {
        toast.error(`Webhook returned status ${result.statusCode}`);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Webhook test failed');
    }
  };

  const handleRevokeApiKey = async (apiKeyId: string) => {
    try {
      await revokeApiKey(apiKeyId);
      await syncSettings();
      toast.success('API key revoked');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to revoke API key');
    }
  };

  return (
    <div className="max-w-6xl flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-gt-text">Settings</h1>
          <p className="text-sm text-gt-muted">Manage system configuration, integrations, and access.</p>
        </div>
      </div>

      <div className="flex gap-6">
        <div className="w-64 flex-shrink-0">
          <nav className="flex flex-col gap-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    active ? 'bg-gt-surface2 text-gt-accent' : 'text-gt-text hover:bg-[rgba(255,255,255,0.02)]'
                  }`}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex-1">
          {activeTab === 'general' && (
            <Panel className="p-6 space-y-6">
              <h2 className="text-lg font-bold text-gt-text border-b border-[rgba(255,255,255,0.05)] pb-2">General Configuration</h2>

              {settingsLoading ? (
                <div className="p-6">Loading settings...</div>
              ) : settingsError ? (
                <div className="p-6 text-gt-danger">{settingsError}</div>
              ) : (
                <div className="space-y-4 max-w-2xl">
                  <div>
                    <label className="block text-sm font-semibold text-gt-text mb-1">Organization Name</label>
                    <input
                      type="text"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      className="w-full bg-gt-surface2 border border-[rgba(255,255,255,0.1)] rounded p-2 text-sm text-gt-text focus:border-gt-accent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gt-text mb-1">Support Email</label>
                    <input
                      type="email"
                      value={supportEmail}
                      onChange={(e) => setSupportEmail(e.target.value)}
                      className="w-full bg-gt-surface2 border border-[rgba(255,255,255,0.1)] rounded p-2 text-sm text-gt-text focus:border-gt-accent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gt-text mb-1">Default Timezone</label>
                    <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full bg-gt-surface2 border border-[rgba(255,255,255,0.1)] rounded p-2 text-sm text-gt-text focus:border-gt-accent outline-none">
                      <option>UTC</option>
                      <option>America/New_York</option>
                      <option>Europe/London</option>
                      <option>Asia/Tokyo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gt-text mb-1">Webhook URL</label>
                    <input
                      type="url"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://hooks.example.com/ghosttrace"
                      className="w-full bg-gt-surface2 border border-[rgba(255,255,255,0.1)] rounded p-2 text-sm text-gt-text focus:border-gt-accent outline-none"
                    />
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm text-gt-text">
                    <input
                      type="checkbox"
                      checked={mfaRequired}
                      onChange={(e) => setMfaRequired(e.target.checked)}
                    />
                    Require MFA for admin accounts
                  </label>
                  <div className="pt-2">
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="bg-gt-accent text-black font-bold px-4 py-2 rounded text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              )}
            </Panel>
          )}

          {activeTab === 'integrations' && (
            <Panel className="p-6 space-y-6">
              <h2 className="text-lg font-bold text-gt-text border-b border-[rgba(255,255,255,0.05)] pb-2">Third-Party Integrations</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-[rgba(255,255,255,0.05)] p-4 rounded-lg bg-gt-surface2 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#4A154B] rounded flex items-center justify-center text-white font-bold text-xl">S</div>
                    <div>
                      <h4 className="font-semibold text-sm text-gt-text">Slack</h4>
                      <p className="text-xs text-gt-muted">Configure webhook via Notifications tab.</p>
                    </div>
                  </div>
                  <button onClick={handleWebhookTest} className="text-xs font-semibold text-gt-text border border-[rgba(255,255,255,0.1)] px-2 py-1 rounded hover:bg-gt-surface">Test</button>
                </div>
              </div>
            </Panel>
          )}

          {activeTab === 'security' && (
            <Panel className="p-6 space-y-6">
              <div className="flex justify-between items-center border-b border-[rgba(255,255,255,0.05)] pb-2">
                <h2 className="text-lg font-bold text-gt-text">API Keys & Authentication</h2>
                <button onClick={handleGenerateApiKey} className="text-sm text-black bg-gt-accent px-3 py-1.5 rounded font-semibold hover:opacity-90">Generate New Key</button>
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-gt-muted mb-1">Key name</label>
                  <input
                    value={apiKeyName}
                    onChange={(e) => setApiKeyName(e.target.value)}
                    className="w-full bg-gt-surface2 border border-[rgba(255,255,255,0.1)] rounded p-2 text-sm text-gt-text"
                  />
                </div>
              </div>

              {newApiKey && (
                <div className="rounded border border-gt-accent/30 bg-gt-accent/10 p-3">
                  <p className="text-xs text-gt-text mb-1">Copy this key now (shown once):</p>
                  <code className="text-xs break-all text-gt-accent">{newApiKey}</code>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[rgba(255,255,255,0.05)] text-gt-muted">
                      <th className="py-2 font-medium">Name</th>
                      <th className="py-2 font-medium">Key Prefix</th>
                      <th className="py-2 font-medium">Created</th>
                      <th className="py-2 font-medium">Last Used</th>
                      <th className="py-2 font-medium text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(apiKeys || []).map((key) => (
                      <tr key={`${key.name}-${key.createdAt}`} className="border-b border-[rgba(255,255,255,0.02)] text-gt-text">
                        <td className="py-3 font-semibold">{key.name}</td>
                        <td className="py-3 font-mono text-gt-muted text-xs">{key.keyPrefix}...{key.keyLast4}</td>
                        <td className="py-3 text-gt-muted text-xs">{formatRelativeTime(key.createdAt)}</td>
                        <td className="py-3 text-gt-muted text-xs">{key.lastUsedAt ? formatRelativeTime(key.lastUsedAt) : 'Never'}</td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Badge size="sm" className={key.status === 'active' ? 'border-gt-accent text-gt-accent' : 'border-gt-warn text-gt-warn'}>{key.status}</Badge>
                            {key.status === 'active' && (
                              <button
                                onClick={() => handleRevokeApiKey(key.apiKeyId)}
                                className="text-xs text-gt-danger hover:underline"
                              >
                                Revoke
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(!apiKeys || apiKeys.length === 0) && (
                      <tr>
                        <td className="py-3 text-gt-muted" colSpan={5}>No API keys yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {activeTab === 'notifications' && (
            <Panel className="p-6">
              <h2 className="text-lg font-bold text-gt-text border-b border-[rgba(255,255,255,0.05)] pb-2 mb-6">Alert Routing Rules</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 border border-[rgba(255,255,255,0.05)] rounded bg-[rgba(255,255,255,0.01)]">
                  <div>
                    <p className="text-sm font-semibold text-gt-text">Webhook destination</p>
                    <p className="text-xs text-gt-muted mt-1">{webhookUrl || 'Not configured'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleWebhookTest} className="text-xs text-gt-accent hover:underline">Test</button>
                    <button onClick={handleSave} className="text-xs text-gt-text border border-[rgba(255,255,255,0.1)] px-2 py-1 rounded hover:bg-gt-surface2">Save</button>
                  </div>
                </div>
                <div className="border border-[rgba(255,255,255,0.05)] rounded bg-[rgba(255,255,255,0.01)] overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[rgba(255,255,255,0.05)] text-gt-muted">
                        <th className="p-2">When</th>
                        <th className="p-2">URL</th>
                        <th className="p-2">Status</th>
                        <th className="p-2">By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {webhookLogs.length === 0 ? (
                        <tr><td className="p-2 text-gt-muted" colSpan={4}>No webhook tests yet.</td></tr>
                      ) : webhookLogs.map((log, idx) => (
                        <tr key={`${log.testedAt}-${idx}`} className="border-b border-[rgba(255,255,255,0.03)]">
                          <td className="p-2 text-gt-muted">{formatRelativeTime(log.testedAt)}</td>
                          <td className="p-2 text-gt-text">{log.url}</td>
                          <td className="p-2">
                            <Badge size="sm" className={log.success ? 'border-gt-accent text-gt-accent' : 'border-gt-danger text-gt-danger'}>
                              {log.success ? `OK ${log.statusCode ?? ''}` : `FAILED ${log.statusCode ?? ''}`}
                            </Badge>
                          </td>
                          <td className="p-2 text-gt-muted">{log.testedBy}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
