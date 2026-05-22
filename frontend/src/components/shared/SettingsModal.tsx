'use client';

import React, { useState } from 'react';
import { X, Shield, Bell, Eye, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SettingsModalProps { isOpen: boolean; onClose: () => void; }

const SETTING_TABS = [
  { id: 'thresholds', label: 'Thresholds', icon: Shield },
  { id: 'alerts',     label: 'Alerts',     icon: Bell   },
  { id: 'display',    label: 'Display',    icon: Eye    },
  { id: 'about',      label: 'About',      icon: Info   },
] as const;

type TabId = typeof SETTING_TABS[number]['id'];

function SliderRow({
  label, description, value, min, max, color, onChange,
}: {
  label: string; description: string; value: number;
  min: number; max: number; color: string; onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[13px] font-semibold text-gt-text">{label}</div>
          <div className="text-[11px] text-gt-muted">{description}</div>
        </div>
        <span className="text-[14px] font-mono font-bold ml-4" style={{ color }}>{value}</span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 rounded-full appearance-none cursor-pointer"
        style={{ background: `linear-gradient(to right, ${color} ${pct}%, #3a4553 0%)` }}
        aria-label={label}
        aria-valuenow={value} aria-valuemin={min} aria-valuemax={max}
      />
      <div className="flex justify-between text-[10px] font-mono text-gt-dim">
        <span>{min}</span><span>{max}</span>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gt-accent/50',
          checked ? 'bg-gt-accent' : 'bg-gt-dim'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200',
            checked ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
      <span className="text-[13px] text-gt-text">{label}</span>
    </label>
  );
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab]   = useState<TabId>('thresholds');
  const [saved, setSaved]           = useState(false);

  const [thresholds, setThresholds] = useState({ blockThreshold: 80, flagThreshold: 50, reviewThreshold: 65 });
  const [alertsCfg, setAlertsCfg]   = useState({ emailAlerts: true, slackAlerts: false, browserNotifications: true, soundEnabled: false, minSeverity: 'high' });
  const [display, setDisplay]       = useState({ refreshInterval: 5, maxFeedItems: 50, showConfidence: true, compactMode: false });

  if (!isOpen) return null;

  const handleSave = () => {
    // In production: PATCH /api/v1/settings
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog" aria-modal="true" aria-label="Settings"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div className="relative w-full max-w-lg bg-gt-surface border border-[rgba(255,255,255,0.1)] rounded-xl shadow-2xl overflow-hidden animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.07)]">
          <div>
            <h2 className="text-[15px] font-bold font-display text-gt-text">Settings</h2>
            <p className="text-[11px] font-mono text-gt-muted">Agent · Alerts · Display</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gt-surface2 transition-colors"
            aria-label="Close settings"
          >
            <X size={16} className="text-gt-muted" />
          </button>
        </div>

        {/* Tab strip */}
        <div className="flex border-b border-[rgba(255,255,255,0.07)] bg-gt-surface2">
          {SETTING_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-selected={activeTab === tab.id}
                role="tab"
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-semibold transition-colors border-b-2 flex-1 justify-center',
                  activeTab === tab.id
                    ? 'text-gt-accent border-gt-accent'
                    : 'text-gt-muted border-transparent hover:text-gt-text'
                )}
              >
                <Icon size={13} aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content area */}
        <div className="px-5 py-5 min-h-[300px] max-h-[60vh] overflow-y-auto">

          {/* ── Thresholds ── */}
          {activeTab === 'thresholds' && (
            <div className="flex flex-col gap-6">
              <div className="bg-gt-surface2 rounded-lg px-4 py-3 text-[11px] font-mono text-gt-muted border border-[rgba(255,255,255,0.06)]">
                ⚙ Adjust fraud score thresholds that control autonomous agent actions.
              </div>
              <SliderRow
                label="Auto-Block Threshold" description="Transactions above this score are automatically blocked"
                value={thresholds.blockThreshold} min={60} max={100} color="#ff3b5c"
                onChange={(v) => setThresholds((p) => ({ ...p, blockThreshold: v }))}
              />
              <SliderRow
                label="Review Threshold" description="Transactions above this score are sent for human review"
                value={thresholds.reviewThreshold} min={40} max={thresholds.blockThreshold - 1} color="#ffb43a"
                onChange={(v) => setThresholds((p) => ({ ...p, reviewThreshold: v }))}
              />
              <SliderRow
                label="Flag Threshold" description="Transactions above this score are flagged for monitoring"
                value={thresholds.flagThreshold} min={20} max={thresholds.reviewThreshold - 1} color="#0095ff"
                onChange={(v) => setThresholds((p) => ({ ...p, flagThreshold: v }))}
              />
            </div>
          )}

          {/* ── Alerts ── */}
          {activeTab === 'alerts' && (
            <div className="flex flex-col gap-4">
              <Toggle checked={alertsCfg.emailAlerts}           onChange={(v) => setAlertsCfg((p) => ({ ...p, emailAlerts: v }))}           label="Email alerts for high-risk detections" />
              <Toggle checked={alertsCfg.slackAlerts}           onChange={(v) => setAlertsCfg((p) => ({ ...p, slackAlerts: v }))}           label="Slack webhook notifications" />
              <Toggle checked={alertsCfg.browserNotifications}  onChange={(v) => setAlertsCfg((p) => ({ ...p, browserNotifications: v }))}  label="Browser push notifications" />
              <Toggle checked={alertsCfg.soundEnabled}          onChange={(v) => setAlertsCfg((p) => ({ ...p, soundEnabled: v }))}          label="Sound alerts for critical fraud" />
              <div className="flex flex-col gap-2 mt-2">
                <label className="text-[12px] font-semibold text-gt-text" htmlFor="min-severity">
                  Minimum alert severity
                </label>
                <select
                  id="min-severity"
                  value={alertsCfg.minSeverity}
                  onChange={(e) => setAlertsCfg((p) => ({ ...p, minSeverity: e.target.value }))}
                  className="bg-gt-surface2 border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-[12px] font-mono text-gt-text focus:outline-none focus:border-gt-accent/50"
                >
                  <option value="low">Low (all alerts)</option>
                  <option value="medium">Medium and above</option>
                  <option value="high">High and above</option>
                  <option value="critical">Critical only</option>
                </select>
              </div>
            </div>
          )}

          {/* ── Display ── */}
          {activeTab === 'display' && (
            <div className="flex flex-col gap-4">
              <Toggle checked={display.showConfidence} onChange={(v) => setDisplay((p) => ({ ...p, showConfidence: v }))} label="Show confidence percentages" />
              <Toggle checked={display.compactMode}    onChange={(v) => setDisplay((p) => ({ ...p, compactMode: v }))}    label="Compact transaction rows" />
              <div className="flex flex-col gap-2 mt-2">
                <label className="text-[12px] font-semibold text-gt-text" htmlFor="refresh-interval">
                  Data refresh interval: <span className="text-gt-accent">{display.refreshInterval}s</span>
                </label>
                <input
                  id="refresh-interval"
                  type="range" min={2} max={30} value={display.refreshInterval}
                  onChange={(e) => setDisplay((p) => ({ ...p, refreshInterval: Number(e.target.value) }))}
                  className="w-full h-1 appearance-none cursor-pointer rounded-full"
                  style={{ background: `linear-gradient(to right, #00e5a0 ${((display.refreshInterval - 2) / 28) * 100}%, #3a4553 0%)` }}
                  aria-label="Refresh interval in seconds"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[12px] font-semibold text-gt-text" htmlFor="max-items">
                  Max feed items: <span className="text-gt-accent">{display.maxFeedItems}</span>
                </label>
                <input
                  id="max-items"
                  type="range" min={10} max={200} value={display.maxFeedItems}
                  onChange={(e) => setDisplay((p) => ({ ...p, maxFeedItems: Number(e.target.value) }))}
                  className="w-full h-1 appearance-none cursor-pointer rounded-full"
                  style={{ background: `linear-gradient(to right, #00e5a0 ${((display.maxFeedItems - 10) / 190) * 100}%, #3a4553 0%)` }}
                  aria-label="Maximum feed items to display"
                />
              </div>
            </div>
          )}

          {/* ── About ── */}
          {activeTab === 'about' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4 pb-4 border-b border-[rgba(255,255,255,0.06)]">
                <div className="w-12 h-12 bg-gt-accent rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg width="24" height="24" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                    <path d="M9 1L2 5v8l7 4 7-4V5L9 1z" stroke="#0a0c0f" strokeWidth="1.5" fill="none"/>
                    <circle cx="9" cy="9" r="2.5" fill="#0a0c0f"/>
                    <path d="M9 4v2M9 12v2M4 9h2M12 9h2" stroke="#0a0c0f" strokeWidth="1.5"/>
                  </svg>
                </div>
                <div>
                  <div className="text-[15px] font-extrabold font-display text-gt-text">GhostTrace AI</div>
                  <div className="text-[11px] font-mono text-gt-muted">v1.0.0 — Production Build</div>
                </div>
              </div>
              {[
                ['AI Engine',      'Gemini 3'],
                ['Database',       'MongoDB Atlas'],
                ['Integration',    'MCP (Model Context Protocol)'],
                ['Infrastructure', 'Google Cloud Run'],
                ['Hackathon',      'Google Cloud Rapid Agent 2026'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-[12px]">
                  <span className="text-gt-muted font-mono">{k}</span>
                  <span className="text-gt-text font-semibold">{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[rgba(255,255,255,0.07)] bg-gt-surface2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[12px] font-mono text-gt-muted border border-[rgba(255,255,255,0.08)] rounded-lg hover:text-gt-text hover:border-[rgba(255,255,255,0.16)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className={cn(
              'px-5 py-2 text-[12px] font-mono font-bold rounded-lg transition-all',
              saved
                ? 'bg-gt-accent/20 text-gt-accent border border-gt-accent/30'
                : 'bg-gt-accent text-gt-bg hover:opacity-90'
            )}
          >
            {saved ? '✓ Saved' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
