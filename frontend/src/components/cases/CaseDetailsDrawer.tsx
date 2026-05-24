import React, { useState } from 'react';
import { Panel, Badge } from '@/components/shared/ui';
import { X, Save, Clock, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { addCaseNote, updateCase } from '@/lib/api';

interface CaseDetailsDrawerProps {
  caseId: string | null;
  onClose: () => void;
}

export function CaseDetailsDrawer({ caseId, onClose }: CaseDetailsDrawerProps) {
  const [note, setNote] = useState('');
  const [assignee, setAssignee] = useState('Unassigned');
  const [loading, setLoading] = useState(false);

  if (!caseId) return null;

  const handleSaveNote = async () => {
    if (!note.trim()) return;
    setLoading(true);
    try {
      await addCaseNote(caseId, note);
      toast.success('Analyst note added to case');
      setNote('');
    } catch {
      toast.error('Failed to add note');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (newAssignee: string) => {
    setAssignee(newAssignee);
    try {
      await updateCase(caseId, { assignedTo: newAssignee });
      toast.success(`Case assigned to ${newAssignee}`);
    } catch {
      toast.error('Failed to assign case');
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[450px] bg-gt-bg border-l border-[rgba(255,255,255,0.08)] z-50 shadow-2xl flex flex-col animate-slide-in">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(255,255,255,0.05)] bg-gt-surface">
        <div>
          <h2 className="text-sm font-bold text-gt-text">Case {caseId}</h2>
          <p className="text-[11px] text-gt-muted">Investigation Details</p>
        </div>
        <button onClick={onClose} className="text-gt-muted hover:text-gt-text">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        <Panel className="p-4">
          <h3 className="text-[11px] font-mono text-gt-muted uppercase tracking-wider mb-3">Assignment</h3>
          <div className="flex items-center gap-3">
            <select
              value={assignee}
              onChange={(e) => handleAssign(e.target.value)}
              className="bg-gt-surface2 border border-[rgba(255,255,255,0.1)] rounded px-2 py-1.5 text-xs text-gt-text focus:outline-none focus:border-gt-accent flex-1"
            >
              <option value="Unassigned">Unassigned</option>
              <option value="Alice S.">Alice S.</option>
              <option value="Bob J.">Bob J.</option>
            </select>
          </div>
        </Panel>

        <Panel className="p-4">
          <h3 className="text-[11px] font-mono text-gt-muted uppercase tracking-wider mb-3">Analyst Notes</h3>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add investigation findings..."
            className="w-full bg-gt-surface2 border border-[rgba(255,255,255,0.1)] rounded p-3 text-xs text-gt-text min-h-[100px] resize-y focus:outline-none focus:border-gt-accent/50 transition-colors"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={handleSaveNote}
              disabled={loading}
              className="flex items-center gap-2 bg-gt-accent text-black px-3 py-1.5 rounded text-xs font-bold hover:opacity-90 disabled:opacity-50"
            >
              <Save size={12} /> Save Note
            </button>
          </div>
        </Panel>

        <Panel className="p-4">
          <h3 className="text-[11px] font-mono text-gt-muted uppercase tracking-wider mb-3">Timeline</h3>
          <div className="flex flex-col gap-4">
            <div className="flex gap-3">
              <div className="mt-1"><User size={14} className="text-gt-blue" /></div>
              <div>
                <div className="text-xs text-gt-text">Case assigned to {assignee}</div>
                <div className="text-[10px] text-gt-muted font-mono mt-0.5">Just now</div>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="mt-1"><Clock size={14} className="text-gt-warn" /></div>
              <div>
                <div className="text-xs text-gt-text">Case created from alert</div>
                <div className="text-[10px] text-gt-muted font-mono mt-0.5">2 hours ago</div>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
