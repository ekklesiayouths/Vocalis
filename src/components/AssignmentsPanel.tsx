/**
 * Assignments Panel — MD task assignment interface inside the Choir Space.
 *
 * MDs can view their choir roster, assign task templates (e.g., "Assign
 * Interval Module 1"), set a deadline, and view existing assignments.
 * Members see their assigned tasks on the same panel.
 *
 * SECURITY:
 * - Assignment data stored locally in localStorage (dev mode fallback).
 * - All text sanitized via sanitizeText.
 * - No raw user input rendered as HTML.
 */

import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Plus, Calendar, X, Check, User, Crown, Loader2, Trash2 } from 'lucide-react';
import { sanitizeText } from '@/lib/validation';
import { useUser } from '@/context/UserContext';

interface Assignment {
  id: string;
  choirId: string;
  title: string;
  description: string;
  deadline: string;
  assignedTo: string;
  createdBy: string;
  createdAt: string;
}

const LOCAL_ASSIGNMENTS_KEY = 'vocalis-local-assignments';

function loadLocalAssignments(choirId: string): Assignment[] {
  try {
    const raw = localStorage.getItem(LOCAL_ASSIGNMENTS_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as Assignment[];
    return all.filter((a) => a.choirId === choirId);
  } catch {
    return [];
  }
}

function saveLocalAssignment(assignment: Assignment): void {
  try {
    const raw = localStorage.getItem(LOCAL_ASSIGNMENTS_KEY);
    const all = raw ? JSON.parse(raw) as Assignment[] : [];
    all.push(assignment);
    localStorage.setItem(LOCAL_ASSIGNMENTS_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

function deleteLocalAssignment(id: string): void {
  try {
    const raw = localStorage.getItem(LOCAL_ASSIGNMENTS_KEY);
    if (!raw) return;
    const all = JSON.parse(raw) as Assignment[];
    const filtered = all.filter((a) => a.id !== id);
    localStorage.setItem(LOCAL_ASSIGNMENTS_KEY, JSON.stringify(filtered));
  } catch { /* ignore */ }
}

const TASK_TEMPLATES = [
  { title: 'Assign Interval Module 1', description: 'Complete the Interval Recognition module in the Academy' },
  { title: 'Assign Daily Warm-Up', description: 'Complete today\'s warm-up routine (5 minutes)' },
  { title: 'Assign Scale Degrees', description: 'Practice the Scale Degrees module' },
  { title: 'Assign Breath Support', description: 'Complete the Breath Support Tracker exercise' },
  { title: 'Assign Harmony Practice', description: 'Practice 3rd/5th Finding with a partner' },
];

interface AssignmentsPanelProps {
  choirId: string;
  isDirector: boolean;
  members: { id: string; display_name: string | null; role: string }[];
}

export function AssignmentsPanel({ choirId, isDirector, members }: AssignmentsPanelProps) {
  const { profile } = useUser();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [deadline, setDeadline] = useState('');
  const [assignedTo, setAssignedTo] = useState('all');
  const [saving, setSaving] = useState(false);

  const loadAssignments = useCallback(() => {
    setLoading(true);
    setAssignments(loadLocalAssignments(choirId));
    setLoading(false);
  }, [choirId]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const handleCreate = useCallback(() => {
    const title = selectedTemplate !== null
      ? TASK_TEMPLATES[selectedTemplate].title
      : sanitizeText(customTitle, 120);
    if (title.length === 0) return;
    const desc = selectedTemplate !== null
      ? TASK_TEMPLATES[selectedTemplate].description
      : sanitizeText(customDesc, 300);
    const cleanDeadline = sanitizeText(deadline, 50);

    setSaving(true);
    const assignment: Assignment = {
      id: 'local-assign-' + Date.now(),
      choirId,
      title: title.replace(/^Assign\s+/i, ''),
      description: desc,
      deadline: cleanDeadline || 'No deadline set',
      assignedTo: assignedTo === 'all' ? 'All Members' : assignedTo,
      createdBy: profile.displayName || 'Director',
      createdAt: new Date().toISOString(),
    };
    saveLocalAssignment(assignment);
    setAssignments((prev) => [assignment, ...prev]);
    setShowForm(false);
    setSelectedTemplate(null);
    setCustomTitle('');
    setCustomDesc('');
    setDeadline('');
    setAssignedTo('all');
    setSaving(false);
  }, [selectedTemplate, customTitle, customDesc, deadline, assignedTo, choirId, profile.displayName]);

  const handleDelete = useCallback((id: string) => {
    deleteLocalAssignment(id);
    setAssignments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return (
    <div className="card flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-mustard-deep" />
          <h3 className="font-semibold text-charcoal">Assignments & Tasks</h3>
        </div>
        {isDirector && !showForm && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 rounded-xl bg-mustard-light border border-mustard-DEFAULT px-3 py-1.5 text-xs font-medium text-mustard-deep transition-all hover:bg-mustard hover:text-charcoal active:translate-y-0.5">
            <Plus className="h-3.5 w-3.5" /> New Task
          </button>
        )}
      </div>

      {showForm && isDirector && (
        <div className="flex flex-col gap-4 rounded-xl bg-cream-100 border border-cream-400 p-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-charcoal">Create Assignment</h4>
            <button onClick={() => setShowForm(false)} className="text-charcoal-muted hover:text-charcoal">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Task templates */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-charcoal-muted">Quick Templates</label>
            <div className="flex flex-wrap gap-2">
              {TASK_TEMPLATES.map((tmpl, i) => (
                <button
                  key={i}
                  onClick={() => { setSelectedTemplate(i); setCustomTitle(''); setCustomDesc(''); }}
                  className={`rounded-xl px-3 py-2 text-xs font-medium transition-all active:translate-y-0.5 ${
                    selectedTemplate === i
                      ? 'bg-sage-DEFAULT text-cream-50 shadow-paper-sm'
                      : 'bg-cream-50 border border-cream-400 text-charcoal hover:bg-sage-light hover:text-sage-deep'
                  }`}
                >
                  {tmpl.title}
                </button>
              ))}
            </div>
          </div>

          {/* Custom title/desc (if no template selected) */}
          {selectedTemplate === null && (
            <>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                maxLength={120}
                placeholder="Task title..."
                className="rounded-xl bg-cream-50 border border-cream-400 px-4 py-2.5 text-sm text-charcoal outline-none focus:border-sage-DEFAULT"
              />
              <input
                type="text"
                value={customDesc}
                onChange={(e) => setCustomDesc(e.target.value)}
                maxLength={300}
                placeholder="Description (optional)"
                className="rounded-xl bg-cream-50 border border-cream-400 px-4 py-2.5 text-sm text-charcoal outline-none focus:border-sage-DEFAULT"
              />
            </>
          )}

          {/* Deadline + assignee */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              maxLength={50}
              placeholder="Deadline (e.g., 'Friday 5pm')"
              className="flex-1 rounded-xl bg-cream-50 border border-cream-400 px-4 py-2.5 text-sm text-charcoal outline-none focus:border-sage-DEFAULT"
            />
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="rounded-xl bg-cream-50 border border-cream-400 px-4 py-2.5 text-sm text-charcoal outline-none focus:border-sage-DEFAULT"
            >
              <option value="all">All Members</option>
              {members.map((m) => (
                <option key={m.id} value={m.display_name || 'Unknown'}>{m.display_name || 'Unknown'}</option>
              ))}
            </select>
          </div>

          <button onClick={handleCreate} disabled={saving || (selectedTemplate === null && customTitle.trim().length === 0)} className="btn-primary text-sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Assign Task
          </button>
        </div>
      )}

      {/* Assignment list */}
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 text-charcoal-muted animate-spin" />
        </div>
      ) : assignments.length === 0 ? (
        <div className="text-center py-6">
          <ClipboardList className="mx-auto h-8 w-8 text-charcoal-muted/30 mb-2" />
          <p className="text-sm text-charcoal-muted">
            {isDirector ? 'No tasks assigned yet. Click "New Task" to assign work to your choir.' : 'No tasks assigned yet. Check back soon!'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {assignments.map((a) => (
            <div key={a.id} className="flex flex-col gap-2 rounded-xl bg-cream-50 border border-cream-400 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <h4 className="font-medium text-charcoal">{a.title}</h4>
                  {a.description && <p className="text-xs text-charcoal-muted">{a.description}</p>}
                </div>
                {isDirector && (
                  <button onClick={() => handleDelete(a.id)} className="text-charcoal-muted hover:text-terracotta-deep transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-charcoal-muted">
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {a.deadline}</span>
                <span className="flex items-center gap-1"><User className="h-3 w-3" /> {a.assignedTo}</span>
                <span className="flex items-center gap-1"><Crown className="h-3 w-3" /> {a.createdBy}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
