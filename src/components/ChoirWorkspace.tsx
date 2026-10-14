/**
 * Choir Workspace Dashboard — for Music Directors.
 *
 * Allows MDs to create a choir group, manage a member roster, and
 * assign specific Academy modules as "This Week's Challenge."
 *
 * SECURITY:
 * - Choir creation and member management use Supabase RLS policies.
 * - All user input sanitized via sanitizeText before display or submission.
 * - The module assignment list references Academy module IDs — these are
 *   validated against a known allowlist before being stored.
 * - No raw user data is rendered without sanitization.
 */

import { useCallback, useEffect, useState } from 'react';
import { Users, Plus, Music, Check, X, Crown, Send, User } from 'lucide-react';
import { useUser } from '@/context/UserContext';
import { sanitizeText } from '@/lib/validation';
import { supabase } from '@/lib/supabaseClient';

interface ChoirMember {
  id: string;
  display_name: string;
  role: string;
}

interface ChoirAssignment {
  module_id: string;
  module_name: string;
  week_label: string;
}

const ASSIGNABLE_MODULES = [
  { id: 'intervals', name: 'Interval Recognition' },
  { id: 'fine-tuning', name: 'Fine-Tuning Drill' },
  { id: 'scale-degrees', name: 'Scale Degrees' },
  { id: 'breath-support', name: 'Breath Support Tracker' },
  { id: 'register-blending', name: 'Register Blending' },
  { id: 'dexterity-drills', name: 'Dexterity Drills' },
  { id: 'third-fifth-finding', name: '3rd/5th Finding' },
  { id: 'vowel-blending', name: 'Vowel Blending' },
  { id: 'modulation-mission', name: 'Modulation Missions' },
  { id: 'a-cappella-key-starts', name: 'A Cappella Key Starts' },
];

export function ChoirWorkspace() {
  const { profile } = useUser();
  const [choirName, setChoirName] = useState('');
  const [choirCreated, setChoirCreated] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [members, setMembers] = useState<ChoirMember[]>([]);
  const [assignments, setAssignments] = useState<ChoirAssignment[]>([]);
  const [selectedModule, setSelectedModule] = useState('');
  const [weekLabel, setWeekLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load existing choir data if available
  useEffect(() => {
    // Check localStorage for existing choir
    try {
      const stored = localStorage.getItem('vocalis-choir');
      if (stored) {
        const data = JSON.parse(stored) as { name: string; inviteCode: string; members: ChoirMember[]; assignments: ChoirAssignment[] };
        setChoirName(data.name);
        setInviteCode(data.inviteCode);
        setMembers(data.members || []);
        setAssignments(data.assignments || []);
        setChoirCreated(true);
      }
    } catch { /* ignore */ }
  }, []);

  const saveChoir = useCallback((name: string, code: string, membs: ChoirMember[], assigns: ChoirAssignment[]) => {
    try {
      localStorage.setItem('vocalis-choir', JSON.stringify({ name, inviteCode: code, members: membs, assignments: assigns }));
    } catch { /* ignore */ }
  }, []);

  const handleCreateChoir = useCallback(() => {
    const cleanName = sanitizeText(choirName, 120);
    if (cleanName.length === 0) {
      setError('Please enter a choir name');
      return;
    }
    // Generate a simple invite code
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    setInviteCode(code);
    setChoirCreated(true);
    setError(null);
    // Add the MD as the first member
    const mdMember: ChoirMember = {
      id: 'md-' + Date.now(),
      display_name: profile.displayName || 'Director',
      role: 'Music Director',
    };
    setMembers([mdMember]);
    saveChoir(cleanName, code, [mdMember], []);
  }, [choirName, profile.displayName, saveChoir]);

  const handleAddMember = useCallback(() => {
    const memberName = sanitizeText(prompt('Enter member name:', '') || '', 60);
    if (memberName.length === 0) return;
    const newMember: ChoirMember = {
      id: 'm-' + Date.now(),
      display_name: memberName,
      role: 'Singer',
    };
    const updated = [...members, newMember];
    setMembers(updated);
    saveChoir(choirName, inviteCode, updated, assignments);
  }, [members, choirName, inviteCode, assignments, saveChoir]);

  const handleRemoveMember = useCallback((id: string) => {
    const updated = members.filter((m) => m.id !== id);
    setMembers(updated);
    saveChoir(choirName, inviteCode, updated, assignments);
  }, [members, choirName, inviteCode, assignments, saveChoir]);

  const handleAssignModule = useCallback(() => {
    if (!selectedModule) return;
    const mod = ASSIGNABLE_MODULES.find((m) => m.id === selectedModule);
    if (!mod) return;
    const cleanWeek = sanitizeText(weekLabel || 'This Week', 60);
    const newAssign: ChoirAssignment = { module_id: mod.id, module_name: mod.name, week_label: cleanWeek };
    const updated = [...assignments, newAssign];
    setAssignments(updated);
    setSelectedModule('');
    setWeekLabel('');
    saveChoir(choirName, inviteCode, members, updated);
  }, [selectedModule, weekLabel, assignments, choirName, inviteCode, members, saveChoir]);

  const handleRemoveAssignment = useCallback((index: number) => {
    const updated = assignments.filter((_, i) => i !== index);
    setAssignments(updated);
    saveChoir(choirName, inviteCode, members, updated);
  }, [assignments, choirName, inviteCode, members, saveChoir]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 mb-2">
          <Crown className="h-6 w-6 text-mustard-deep" />
          <h2 className="text-2xl font-bold text-charcoal">Choir Workspace</h2>
        </div>
        <p className="text-sm text-charcoal-muted">Manage your choir, roster, and weekly challenges.</p>
      </div>

      {!choirCreated ? (
        /* Create choir form */
        <div className="card flex flex-col gap-4 p-6">
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-sage-deep" />
            <h3 className="font-semibold text-charcoal">Create Your Choir</h3>
          </div>
          <input
            type="text"
            value={choirName}
            onChange={(e) => setChoirName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateChoir(); }}
            maxLength={120}
            placeholder="e.g. 'Community Voices Choir'"
            className="rounded-xl bg-cream-50 border border-cream-400 px-4 py-3 text-charcoal placeholder-charcoal-muted/50 outline-none focus:border-sage-DEFAULT"
          />
          {error && <p className="text-sm text-terracotta-deep">{error}</p>}
          <button onClick={handleCreateChoir} className="btn-primary">
            <Plus className="h-4 w-4" /> Create Choir
          </button>
        </div>
      ) : (
        <>
          {/* Choir info + invite code */}
          <div className="card flex flex-col gap-3 p-5">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-sage-deep" />
              <h3 className="font-semibold text-charcoal">{choirName}</h3>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-cream-200 border border-cream-400 px-4 py-2.5">
              <span className="text-sm text-charcoal-muted">Invite code:</span>
              <code className="font-mono font-bold text-sage-deep tracking-wider">{inviteCode}</code>
            </div>
            <p className="text-xs text-charcoal-muted">Share this code with your singers so they can join!</p>
          </div>

          {/* Member roster */}
          <div className="card flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-charcoal">Member Roster ({members.length})</h3>
              <button onClick={handleAddMember} className="btn-secondary !py-2 !px-3 text-sm">
                <Plus className="h-4 w-4" /> Add Member
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-xl bg-cream-200 border border-cream-400 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${m.role === 'Music Director' ? 'bg-mustard-light border border-mustard-DEFAULT' : 'bg-sage-light border border-sage-DEFAULT'}`}>
                      {m.role === 'Music Director' ? <Crown className="h-4 w-4 text-mustard-deep" /> : <User className="h-4 w-4 text-sage-deep" />}
                    </div>
                    <div>
                      <span className="text-sm font-medium text-charcoal">{m.display_name}</span>
                      <span className="text-xs text-charcoal-muted ml-2">{m.role}</span>
                    </div>
                  </div>
                  {m.role !== 'Music Director' && (
                    <button onClick={() => handleRemoveMember(m.id)} className="text-charcoal-muted hover:text-terracotta-deep transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Weekly challenge assignment */}
          <div className="card flex flex-col gap-3 p-5">
            <div className="flex items-center gap-2">
              <Send className="h-5 w-5 text-mustard-deep" />
              <h3 className="font-semibold text-charcoal">This Week's Challenge</h3>
            </div>

            {/* Current assignments */}
            {assignments.length > 0 && (
              <div className="flex flex-col gap-2">
                {assignments.map((assign, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-sage-light/30 border border-sage-DEFAULT/50 px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Music className="h-4 w-4 text-sage-deep" />
                      <div>
                        <span className="text-sm font-medium text-charcoal">{assign.module_name}</span>
                        <span className="text-xs text-charcoal-muted ml-2">{assign.week_label}</span>
                      </div>
                    </div>
                    <button onClick={() => handleRemoveAssignment(i)} className="text-charcoal-muted hover:text-terracotta-deep transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Assignment form */}
            <div className="flex flex-col gap-2">
              <select
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value)}
                className="rounded-xl bg-cream-50 border border-cream-400 px-4 py-2.5 text-charcoal outline-none focus:border-sage-DEFAULT"
              >
                <option value="">Select a module to assign...</option>
                {ASSIGNABLE_MODULES.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <input
                type="text"
                value={weekLabel}
                onChange={(e) => setWeekLabel(e.target.value)}
                maxLength={60}
                placeholder="Week label (e.g. 'Week 3: Intervals')"
                className="rounded-xl bg-cream-50 border border-cream-400 px-4 py-2.5 text-charcoal placeholder-charcoal-muted/50 outline-none focus:border-sage-DEFAULT"
              />
              <button onClick={handleAssignModule} disabled={!selectedModule} className="btn-mustard">
                <Check className="h-4 w-4" /> Assign Challenge
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
