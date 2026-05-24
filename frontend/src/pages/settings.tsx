'use client';

import React, { useState } from 'react';
import { Panel, Badge } from '@/components/shared/ui';
import { Settings, Bell, ShieldCheck, Link2 } from 'lucide-react';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'integrations', label: 'Integrations', icon: Link2 },
  { id: 'security', label: 'Security & API', icon: ShieldCheck },
  { id: 'notifications', label: 'Notifications', icon: Bell },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast.success('Settings saved successfully');
    }, 1000);
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
        {/* Sidebar Nav */}
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

        {/* Tab Content */}
        <div className="flex-1">
          {/* General */}
          {activeTab === 'general' && (
            <Panel className="p-6 space-y-6">
              <h2 className="text-lg font-bold text-gt-text border-b border-[rgba(255,255,255,0.05)] pb-2">
                General Configuration
              </h2>
              <div className="space-y-4 max-w-2xl">
                <div>
                  <label className="block text-sm font-semibold text-gt-text mb-1">Organization Name</label>
                  <input
                    type="text"
                    defaultValue="GhostTrace Global"
                    className="w-full bg-gt-surface2 border border-[rgba(255,255,255,0.1)] rounded p-2 text-sm text-gt-text focus:border-gt-accent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gt-text mb-1">Support Email</label>
                  <input
                    type="email"
                    defaultValue="soc@ghosttrace.ai"
                    className="w-full bg-gt-surface2 border border-[rgba(255,255,255,0.1)] rounded p-2 text-sm text-gt-text focus:border-gt-accent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gt-text mb-1">Default Timezone</label>
                  <select className="w-full bg-gt-surface2 border border-[rgba(255,255,255,0.1)] rounded p-2 text-sm text-gt-text focus:border-gt-accent outline-none">
                    <option>UTC</option>
                    <option>America/New_York</option>
                    <option>Europe/London</option>
                    <option>Asia/Tokyo</option>
                  </select>
                </div>
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
            </Panel>
          )}

          {/* Integrations */}
          {activeTab === 'integrations' && (
            <Panel className="p-6 space-y-6">
              <h2 className="text-lg font-bold text-gt-text border-b border-[rgba(255,255,255,0.05)] pb-2">
                Third-Party Integrations
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Slack */}
                <div className="border border-[rgba(255,255,255,0.05)] p-4 rounded-lg bg-gt-surface2 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#4A154B] rounded flex items-center justify-center text-white font-bold text-xl">S</div>
                    <div>
                      <h4 className="font-semibold text-sm text-gt-text">Slack</h4>
                      <p className="text-xs text-gt-muted">Connected to #soc-alerts</p>
                    </div>
                  </div>
                  <button
                    onClick={() => toast.success('Slack disconnected')}
                    className="text-xs font-semibold text-gt-muted hover:text-gt-danger transition-colors"
                  >
                    Disconnect
                  </button>
                </div>

                {/* Discord */}
                <div className="border border-[rgba(255,255,255,0.05)] p-4 rounded-lg bg-[rgba(255,255,255,0.02)] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#5865F2] rounded flex items-center justify-center text-white font-bold text-xl">D</div>
                    <div>
                      <h4 className="font-semibold text-sm text-gt-text">Discord</h4>
                      <p className="text-xs text-gt-muted">Not connected</p>
                    </div>
                  </div>
                  <button
                    onClick={() => toast.success('Discord OAuth flow started')}
                    className="text-xs font-semibold text-gt-accent hover:opacity-80 transition-opacity"
                  >
                    Connect
                  </button>
                </div>

                {/* Webhook */}
                <div className="border border-[rgba(255,255,255,0.05)] p-4 rounded-lg bg-gt-surface2 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gt-dim rounded flex items-center justify-center text-gt-text">
                      <Link2 size={20} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-gt-text">Custom Webhook</h4>
                      <p className="text-xs text-gt-muted">Active (1 endpoint)</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toast.success('Webhook tested successfully!')}
                      className="text-xs font-semibold text-gt-text border border-[rgba(255,255,255,0.1)] px-2 py-1 rounded hover:bg-gt-surface"
                    >
                      Test
                    </button>
                    <button
                      onClick={() => toast('Webhook configuration panel opening...', { icon: '⚙️' })}
                      className="text-xs font-semibold text-gt-text border border-[rgba(255,255,255,0.1)] px-2 py-1 rounded hover:bg-gt-surface"
                    >
                      Configure
                    </button>
                  </div>
                </div>
              </div>
            </Panel>
          )}

          {/* Security */}
          {activeTab === 'security' && (
            <Panel className="p-6 space-y-6">
              <div className="flex justify-between items-center border-b border-[rgba(255,255,255,0.05)] pb-2">
                <h2 className="text-lg font-bold text-gt-text">API Keys & Authentication</h2>
                <button
                  onClick={() => toast.success('New API key generated — copy it now, it will not be shown again.')}
                  className="text-sm text-black bg-gt-accent px-3 py-1.5 rounded font-semibold hover:opacity-90"
                >
                  Generate New Key
                </button>
              </div>

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
                    <tr className="border-b border-[rgba(255,255,255,0.02)] text-gt-text">
                      <td className="py-3 font-semibold">Production Ingestion</td>
                      <td className="py-3 font-mono text-gt-muted text-xs">gt_prod_8f29...</td>
                      <td className="py-3 text-gt-muted text-xs">Oct 12, 2025</td>
                      <td className="py-3 text-gt-muted text-xs">2 mins ago</td>
                      <td className="py-3 text-right">
                        <Badge size="sm" className="border-gt-accent text-gt-accent">Active</Badge>
                      </td>
                    </tr>
                    <tr className="border-b border-[rgba(255,255,255,0.02)] text-gt-text">
                      <td className="py-3 font-semibold">Developer Testing</td>
                      <td className="py-3 font-mono text-gt-muted text-xs">gt_dev_a1b2...</td>
                      <td className="py-3 text-gt-muted text-xs">Nov 05, 2025</td>
                      <td className="py-3 text-gt-muted text-xs">3 days ago</td>
                      <td className="py-3 text-right">
                        <Badge size="sm" className="border-gt-accent text-gt-accent">Active</Badge>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-4">
                <h2 className="text-lg font-bold text-gt-text border-b border-[rgba(255,255,255,0.05)] pb-2 mb-4">MFA Settings</h2>
                <p className="text-sm text-gt-muted mb-4">Multi-factor authentication is required for all Admin accounts.</p>
                <button
                  onClick={() => toast.success('Global MFA policy updated')}
                  className="text-sm border border-[rgba(255,255,255,0.1)] px-4 py-2 rounded text-gt-text font-semibold hover:bg-gt-surface2 transition-colors"
                >
                  Manage Global MFA Policy
                </button>
              </div>
            </Panel>
          )}

          {/* Notifications */}
          {activeTab === 'notifications' && (
            <Panel className="p-6">
              <h2 className="text-lg font-bold text-gt-text border-b border-[rgba(255,255,255,0.05)] pb-2 mb-6">
                Alert Routing Rules
              </h2>
              <div className="space-y-4">
                {[
                  { level: 'Critical Alerts (Score > 90)', target: 'Slack #soc-alerts, Email to Admins' },
                  { level: 'High Alerts (Score 75-89)', target: 'Slack #soc-alerts' },
                  { level: 'System Errors / Failures', target: 'Email to Devops' },
                ].map((rule, i) => (
                  <div key={i} className="flex justify-between items-center p-3 border border-[rgba(255,255,255,0.05)] rounded bg-[rgba(255,255,255,0.01)]">
                    <div>
                      <p className="text-sm font-semibold text-gt-text">{rule.level}</p>
                      <p className="text-xs text-gt-muted mt-1">{rule.target}</p>
                    </div>
                    <button
                      onClick={() => toast('Rule editor coming soon', { icon: '✏️' })}
                      className="text-xs text-gt-accent hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
