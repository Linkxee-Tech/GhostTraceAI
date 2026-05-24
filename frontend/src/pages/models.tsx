'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Panel, Badge, Spinner } from '@/components/shared/ui';
import { Zap, Shield, ToggleLeft, ToggleRight, Save } from 'lucide-react';
import { fetchRules, updateRuleStatus, fetchSettings, updateThresholds } from '@/lib/api';
import type { RuleConfig } from '@/lib/types';
import toast from 'react-hot-toast';

const MOCK_RULES: RuleConfig[] = [
  { _id: '1', ruleId: 'R-001', name: 'Velocity Check - High Frequency', description: '>5 transactions within 60 seconds triggers manual review.', category: 'Velocity', status: 'Active', weight: 'High' },
  { _id: '2', ruleId: 'R-002', name: 'Impossible Travel - Geolocation', description: 'Logins from countries >5000 miles apart under 2 hours.', category: 'Geo', status: 'Active', weight: 'Critical' },
  { _id: '3', ruleId: 'R-003', name: 'Device Fingerprint Anomaly', description: 'Mismatch between historical device hash and current request.', category: 'Device', status: 'Inactive', weight: 'Medium' },
];

export default function ModelsPage() {
  const { data: rulesData, isLoading: loadingRules, mutate: mutateRules } = useSWR('rules', fetchRules);
  const { data: settingsData, isLoading: loadingSettings } = useSWR('settings', fetchSettings);

  const rules = rulesData || MOCK_RULES;

  const [autoBlock, setAutoBlock] = useState(90);
  const [autoFlag, setAutoFlag] = useState(75);
  const [savingThresholds, setSavingThresholds] = useState(false);

  useEffect(() => {
    if (settingsData) {
      setAutoBlock(settingsData.autoBlockThreshold);
      setAutoFlag(settingsData.autoFlagThreshold);
    }
  }, [settingsData]);

  const handleToggleRule = async (ruleId: string, currentStatus: 'Active' | 'Inactive') => {
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    try {
      await updateRuleStatus(ruleId, newStatus);
      toast.success(`Rule ${newStatus.toLowerCase()}d`);
      mutateRules();
    } catch {
      toast.error('Failed to update rule');
    }
  };

  const handleSaveThresholds = async () => {
    setSavingThresholds(true);
    try {
      await updateThresholds({ autoBlockThreshold: autoBlock, autoFlagThreshold: autoFlag });
      toast.success('Thresholds updated successfully');
    } catch {
      toast.error('Failed to save thresholds');
    } finally {
      setSavingThresholds(false);
    }
  };

  return (
    <div className="max-w-6xl flex flex-col gap-6 relative">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-gt-text">Models & Rules</h1>
          <p className="text-sm text-gt-muted">Configure AI agent thresholds and deterministic fraud rules.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Panel className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <Zap className="text-gt-accent" size={24} />
            <h3 className="font-bold text-lg text-gt-text">AI Agent Sensitivity</h3>
          </div>
          <p className="text-sm text-gt-muted mb-4">Adjust the confidence threshold for autonomous actions.</p>
          
          {loadingSettings ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : (
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gt-text">Auto-Block Threshold</span>
                  <span className="text-gt-accent font-mono">{autoBlock}/100</span>
                </div>
                <input 
                  type="range" 
                  min="0" max="100" 
                  value={autoBlock} 
                  onChange={(e) => setAutoBlock(parseInt(e.target.value))}
                  className="w-full accent-gt-accent" 
                />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gt-text">Auto-Flag Threshold</span>
                  <span className="text-gt-warn font-mono">{autoFlag}/100</span>
                </div>
                <input 
                  type="range" 
                  min="0" max="100" 
                  value={autoFlag} 
                  onChange={(e) => setAutoFlag(parseInt(e.target.value))}
                  className="w-full accent-gt-warn" 
                />
              </div>
              
              <button 
                onClick={handleSaveThresholds}
                disabled={savingThresholds}
                className="w-full flex justify-center items-center gap-2 bg-gt-surface2 border border-[rgba(255,255,255,0.1)] py-2 rounded text-sm text-gt-text hover:bg-[rgba(255,255,255,0.05)] transition-colors disabled:opacity-50"
              >
                <Save size={16} />
                {savingThresholds ? 'Saving...' : 'Save Thresholds'}
              </button>
            </div>
          )}
        </Panel>

        <Panel className="p-5 md:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="text-gt-blue" size={24} />
            <h3 className="font-bold text-lg text-gt-text">Deterministic Rules</h3>
          </div>
          <p className="text-sm text-gt-muted mb-4">Rules that bypass AI scoring and trigger immediate actions.</p>
          
          {loadingRules ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : (
            <div className="space-y-3">
              {rules.map(rule => (
                <div key={rule.ruleId} className="flex items-center justify-between p-3 bg-gt-surface2 border border-[rgba(255,255,255,0.05)] rounded-lg">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gt-text text-sm">{rule.name}</span>
                      <Badge size="sm" className="border-gt-muted text-gt-muted">{rule.category}</Badge>
                      <Badge size="sm" className={rule.weight === 'Critical' ? 'text-gt-danger border-gt-danger' : rule.weight === 'High' ? 'text-gt-warn border-gt-warn' : 'text-gt-blue border-gt-blue'}>{rule.weight}</Badge>
                    </div>
                    <p className="text-xs text-gt-muted">{rule.description}</p>
                  </div>
                  <button 
                    onClick={() => handleToggleRule(rule.ruleId, rule.status)} 
                    className="text-gt-text hover:text-gt-accent transition-colors"
                  >
                    {rule.status === 'Active' ? <ToggleRight size={28} className="text-gt-accent" /> : <ToggleLeft size={28} className="text-gt-muted" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
