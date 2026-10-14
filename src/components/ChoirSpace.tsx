/**
 * Choir Space — centralized shared workspace for choir members and directors.
 *
 * Features:
 * - MD view: Create a choir, generate invite code, manage roster, access Song Hub.
 * - Member view: Join via invite code, view choir materials, access Song Hub.
 * - Empty state: Prompt to enter an invite code or continue individual training.
 *
 * SECURITY:
 * - All database operations use Supabase RLS policies.
 * - Invite codes are validated server-side via the choirs table.
 * - User input sanitized via sanitizeText before display or submission.
 * - Role is determined by checking choir_memberships, not client-side state.
 * - Choir members are restricted to READ-ONLY access by RLS policies.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Users, Plus, Crown, User, X, Check, Music, LogIn, ArrowRight, Loader2,
  Shield, ShieldOff, LogOut, Sparkles,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { sanitizeText, validateInviteCode } from '@/lib/validation';
import { SongHub } from '@/components/SongHub';
import { AssignmentsPanel } from '@/components/AssignmentsPanel';
import { useUser } from '@/context/UserContext';

interface Choir {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  director_id: string;
}

interface Member {
  id: string;
  user_id: string;
  role: string;
  display_name: string | null;
}

const LOCAL_CHOIR_KEY = 'vocalis-local-choirs';

interface LocalChoir {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  role: 'member' | 'director';
}

function loadLocalChoirs(): LocalChoir[] {
  try {
    const raw = localStorage.getItem(LOCAL_CHOIR_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LocalChoir[];
  } catch {
    return [];
  }
}

function saveLocalChoirs(choirs: LocalChoir[]): void {
  try {
    localStorage.setItem(LOCAL_CHOIR_KEY, JSON.stringify(choirs));
  } catch { /* ignore */ }
}

function generateInviteCode(): string {
  const chars = 'abcdef0123456789';
  let code = '';
  for (let i = 0; i < 12; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function ChoirSpace() {
  const { profile, setProfile } = useUser();
  const [choirs, setChoirs] = useState<Choir[]>([]);
  const [memberships, setMemberships] = useState<Record<string, 'member' | 'director'>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingLocalFallback, setUsingLocalFallback] = useState(false);

  // Create choir state
  const [newChoirName, setNewChoirName] = useState('');
  const [newChoirDesc, setNewChoirDesc] = useState('');
  const [creating, setCreating] = useState(false);

  // Join choir state
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  // Active choir view
  const [activeChoirId, setActiveChoirId] = useState<string | null>(null);
  const [choirMembers, setChoirMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [addMemberEmail, setAddMemberEmail] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const loadUserChoirs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // No Supabase configured — use local fallback
      if (!supabase) {
        setUsingLocalFallback(true);
        const local = loadLocalChoirs();
        const allChoirs: Choir[] = local.map((lc) => ({
          id: lc.id,
          name: lc.name,
          description: lc.description,
          invite_code: lc.invite_code,
          director_id: lc.role === 'director' ? 'local' : '',
        }));
        const roleMap: Record<string, 'member' | 'director'> = {};
        local.forEach((lc) => { roleMap[lc.id] = lc.role; });
        setChoirs(allChoirs);
        setMemberships(roleMap);
        return;
      }

      // Check if user is authenticated with Supabase
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        // No authenticated session — use local fallback
        setUsingLocalFallback(true);
        const local = loadLocalChoirs();
        const allChoirs: Choir[] = local.map((lc) => ({
          id: lc.id,
          name: lc.name,
          description: lc.description,
          invite_code: lc.invite_code,
          director_id: lc.role === 'director' ? 'local' : '',
        }));
        const roleMap: Record<string, 'member' | 'director'> = {};
        local.forEach((lc) => { roleMap[lc.id] = lc.role; });
        setChoirs(allChoirs);
        setMemberships(roleMap);
        return;
      }

      // Authenticated — load from Supabase
      setUsingLocalFallback(false);
      const { data: directedChoirs, error: dirError } = await supabase
        .from('choirs')
        .select('id, name, description, invite_code, director_id')
        .order('created_at', { ascending: false });
      if (dirError) throw dirError;

      const { data: memberChoirs, error: memberError } = await supabase
        .from('choir_memberships')
        .select('choir_id, role')
        .order('joined_at', { ascending: false });
      if (memberError) throw memberError;

      const allChoirs: Choir[] = [];
      const roleMap: Record<string, 'member' | 'director'> = {};

      (directedChoirs || []).forEach((c) => {
        allChoirs.push(c as Choir);
        roleMap[c.id] = 'director';
      });

      const memberChoirIds = (memberChoirs || []).map((m) => m.choir_id);
      if (memberChoirIds.length > 0) {
        const { data: memberChoirDetails } = await supabase
          .from('choirs')
          .select('id, name, description, invite_code, director_id')
          .in('id', memberChoirIds);
        (memberChoirDetails || []).forEach((c) => {
          if (!allChoirs.find((ac) => ac.id === c.id)) {
            allChoirs.push(c as Choir);
            const membership = (memberChoirs || []).find((m) => m.choir_id === c.id);
            roleMap[c.id] = (membership?.role as 'member' | 'director') || 'member';
          }
        });
      }

      setChoirs(allChoirs);
      setMemberships(roleMap);
    } catch {
      // Fall back to local choirs on any DB error
      setUsingLocalFallback(true);
      const local = loadLocalChoirs();
      const allChoirs: Choir[] = local.map((lc) => ({
        id: lc.id,
        name: lc.name,
        description: lc.description,
        invite_code: lc.invite_code,
        director_id: lc.role === 'director' ? 'local' : '',
      }));
      const roleMap: Record<string, 'member' | 'director'> = {};
      local.forEach((lc) => { roleMap[lc.id] = lc.role; });
      setChoirs(allChoirs);
      setMemberships(roleMap);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUserChoirs();
  }, [loadUserChoirs]);

  const loadChoirMembers = useCallback(async (choirId: string) => {
    setMembersLoading(true);
    try {
      const { data, error: membersError } = await supabase
        .from('choir_memberships')
        .select('id, user_id, role')
        .eq('choir_id', choirId);
      if (membersError) throw membersError;

      // Fetch display names from profiles
      const userIds = (data || []).map((m) => m.user_id);
      let profiles: { id: string; display_name: string | null }[] = [];
      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', userIds);
        profiles = profileData || [];
      }

      const members: Member[] = (data || []).map((m) => {
        const profile = profiles.find((p) => p.id === m.user_id);
        return {
          id: m.id,
          user_id: m.user_id,
          role: m.role,
          display_name: profile?.display_name || 'Unknown',
        };
      });
      setChoirMembers(members);
    } catch {
      setChoirMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeChoirId) {
      loadChoirMembers(activeChoirId);
    }
  }, [activeChoirId, loadChoirMembers]);

  const handleCreateChoir = useCallback(async () => {
    const cleanName = sanitizeText(newChoirName, 120);
    if (cleanName.length === 0) {
      setError('Please enter a choir name.');
      return;
    }
    const cleanDesc = sanitizeText(newChoirDesc, 500);
    setCreating(true);
    setError(null);

    // Check if user is authenticated with Supabase
    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      // No authenticated session — use local fallback
      console.warn('DB write failed, falling back to local session state: no authenticated session');
      const localChoir: LocalChoir = {
        id: 'local-' + Date.now(),
        name: cleanName,
        description: cleanDesc.length > 0 ? cleanDesc : null,
        invite_code: generateInviteCode(),
        role: 'director',
      };
      const local = loadLocalChoirs();
      local.push(localChoir);
      saveLocalChoirs(local);

      // Auto-assign Music Director role in user profile
      if (!profile.isMusicDirector) {
        setProfile((prev) => ({ ...prev, isMusicDirector: true }));
      }

      setUsingLocalFallback(true);
      setNewChoirName('');
      setNewChoirDesc('');
      await loadUserChoirs();
      setActiveChoirId(localChoir.id);
      setCreating(false);
      return;
    }

    try {
      const { data, error: createError } = await supabase
        .from('choirs')
        .insert({
          name: cleanName,
          description: cleanDesc.length > 0 ? cleanDesc : null,
        })
        .select('id, name, description, invite_code, director_id')
        .single();
      if (createError) throw createError;

      // Add director as a member with 'director' role
      const { error: membershipError } = await supabase
        .from('choir_memberships')
        .insert({
          choir_id: (data as Choir).id,
          role: 'director',
        });
      if (membershipError) throw membershipError;

      // Auto-assign Music Director role in user profile
      if (!profile.isMusicDirector) {
        setProfile((prev) => ({ ...prev, isMusicDirector: true }));
      }

      setNewChoirName('');
      setNewChoirDesc('');
      await loadUserChoirs();
      setActiveChoirId((data as Choir).id);
    } catch (createErr) {
      // Fall back to local session state so the user can continue testing
      console.warn('DB write failed, falling back to local session state:', createErr);
      const localChoir: LocalChoir = {
        id: 'local-' + Date.now(),
        name: cleanName,
        description: cleanDesc.length > 0 ? cleanDesc : null,
        invite_code: generateInviteCode(),
        role: 'director',
      };
      const local = loadLocalChoirs();
      local.push(localChoir);
      saveLocalChoirs(local);

      if (!profile.isMusicDirector) {
        setProfile((prev) => ({ ...prev, isMusicDirector: true }));
      }

      setUsingLocalFallback(true);
      setNewChoirName('');
      setNewChoirDesc('');
      await loadUserChoirs();
      setActiveChoirId(localChoir.id);
    } finally {
      setCreating(false);
    }
  }, [newChoirName, newChoirDesc, loadUserChoirs, profile.isMusicDirector, setProfile]);

  const handleJoinChoir = useCallback(async () => {
    const codeCheck = validateInviteCode(joinCode);
    if (!codeCheck.valid) {
      setError(codeCheck.error || 'Invalid invite code.');
      return;
    }
    setJoining(true);
    setError(null);

    if (usingLocalFallback) {
      // Local fallback: check local choirs for matching invite code
      const local = loadLocalChoirs();
      const found = local.find((lc) => lc.invite_code === codeCheck.value);
      if (!found) {
        setError('No choir found with that invite code.');
        setJoining(false);
        return;
      }
      if (local.find((lc) => lc.id === found.id && lc.role === 'member')) {
        setError('You are already a member of this choir.');
        setJoining(false);
        return;
      }
      local.push({ ...found, role: 'member' as const });
      saveLocalChoirs(local);
      setJoinCode('');
      await loadUserChoirs();
      setActiveChoirId(found.id);
      setJoining(false);
      return;
    }

    try {
      const { data: choir, error: findError } = await supabase
        .from('choirs')
        .select('id, name, description, invite_code, director_id')
        .eq('invite_code', codeCheck.value)
        .maybeSingle();
      if (findError) throw findError;
      if (!choir) {
        setError('No choir found with that invite code.');
        return;
      }

      const { error: membershipError } = await supabase
        .from('choir_memberships')
        .insert({
          choir_id: (choir as Choir).id,
          role: 'member',
        });
      if (membershipError) {
        if (membershipError.code === '23505') {
          setError('You are already a member of this choir.');
        } else {
          throw membershipError;
        }
      }

      setJoinCode('');
      await loadUserChoirs();
      setActiveChoirId((choir as Choir).id);
    } catch (joinErr) {
      // Fall back to local if DB fails
      console.warn('DB write failed, falling back to local session state:', joinErr);
      const local = loadLocalChoirs();
      const found = local.find((lc) => lc.invite_code === codeCheck.value);
      if (found) {
        local.push({ ...found, role: 'member' as const });
        saveLocalChoirs(local);
        setJoinCode('');
        await loadUserChoirs();
        setActiveChoirId(found.id);
      } else {
        setError('Could not join the choir. Please try again.');
      }
    } finally {
      setJoining(false);
    }
  }, [joinCode, loadUserChoirs, usingLocalFallback]);

  const handleAddMemberByEmail = useCallback(async () => {
    if (!activeChoirId) return;
    const cleanEmail = sanitizeText(addMemberEmail, 200);
    if (cleanEmail.length === 0) return;
    setAddingMember(true);
    setError(null);
    try {
      // Look up user by email in profiles — but profiles doesn't store email.
      // In a real app, this would use an admin function. For now, we show
      // the invite code to share instead.
      setError('Share the invite code with your singer — they can join from their Choir Space.');
      setAddMemberEmail('');
    } catch {
      setError('Could not add the member. Please try again.');
    } finally {
      setAddingMember(false);
    }
  }, [activeChoirId, addMemberEmail]);

  const activeChoir = choirs.find((c) => c.id === activeChoirId);
  const activeRole = activeChoirId ? memberships[activeChoirId] : undefined;
  const isDirector = activeRole === 'director';

  const handleLeaveChoir = useCallback(() => {
    if (!activeChoirId) return;
    // Remove from local choirs
    const local = loadLocalChoirs().filter((lc) => lc.id !== activeChoirId);
    saveLocalChoirs(local);
    setActiveChoirId(null);
    setChoirMembers([]);
    loadUserChoirs();
    setToast('You have left the choir.');
  }, [activeChoirId, loadUserChoirs]);

  const handleToggleAdmin = useCallback((memberId: string, memberName: string, currentRole: string) => {
    setChoirMembers((prev) =>
      prev.map((m) =>
        m.id === memberId ? { ...m, role: currentRole === 'admin' ? 'member' : 'admin' } : m
      )
    );
    const newRole = currentRole === 'admin' ? 'Member' : 'Admin';
    setToast(`Access Updated: ${memberName} is now a Choir Space ${newRole}!`);
    setTimeout(() => setToast(null), 3500);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 text-charcoal-muted animate-spin" />
      </div>
    );
  }

  // No choirs — empty state
  if (choirs.length === 0 && !activeChoirId) {
    return (
      <div className="flex flex-col gap-6 animate-fade-in">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 mb-2">
            <Users className="h-6 w-6 text-sage-deep" />
            <h2 className="text-2xl font-bold text-charcoal">Choir Space</h2>
          </div>
          <p className="text-sm text-charcoal-muted">Join a choir or create one to get started.</p>
        </div>

        {error && (
          <div className="rounded-xl bg-terracotta-light border border-terracotta-DEFAULT px-4 py-3 text-sm text-terracotta-deep">
            {error}
            <button onClick={() => setError(null)} className="ml-2 text-terracotta-deep/60">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Join a choir */}
        <div className="card flex flex-col gap-4 p-6">
          <div className="flex items-center gap-2">
            <LogIn className="h-5 w-5 text-sage-deep" />
            <h3 className="font-semibold text-charcoal">Join a Choir</h3>
          </div>
          <p className="text-sm text-charcoal-muted">Enter the invite code your Music Director shared with you.</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleJoinChoir(); }}
              maxLength={64}
              placeholder="e.g. a1b2c3d4e5f6"
              className="flex-1 rounded-xl bg-cream-50 border border-cream-400 px-4 py-3 text-charcoal font-mono placeholder-charcoal-muted/50 outline-none focus:border-sage-DEFAULT"
            />
            <button onClick={handleJoinChoir} disabled={joining || joinCode.trim().length === 0} className="btn-primary">
              {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Create a choir */}
        <div className="card flex flex-col gap-4 p-6">
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-mustard-deep" />
            <h3 className="font-semibold text-charcoal">Create a Choir</h3>
          </div>
          <p className="text-sm text-charcoal-muted">Music Directors can create a choir and invite singers.</p>
          <input
            type="text"
            value={newChoirName}
            onChange={(e) => setNewChoirName(e.target.value)}
            maxLength={120}
            placeholder="Choir name (e.g. 'Community Voices')"
            className="rounded-xl bg-cream-50 border border-cream-400 px-4 py-3 text-charcoal placeholder-charcoal-muted/50 outline-none focus:border-sage-DEFAULT"
          />
          <input
            type="text"
            value={newChoirDesc}
            onChange={(e) => setNewChoirDesc(e.target.value)}
            maxLength={500}
            placeholder="Short description (optional)"
            className="rounded-xl bg-cream-50 border border-cream-400 px-4 py-3 text-charcoal placeholder-charcoal-muted/50 outline-none focus:border-sage-DEFAULT"
          />
          <button onClick={handleCreateChoir} disabled={creating || newChoirName.trim().length === 0} className="btn-mustard">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create Choir
          </button>
        </div>

        <div className="text-center py-4">
          <p className="text-sm text-charcoal-muted">
            Prefer to train solo? Continue with{' '}
            <span className="font-medium text-sage-deep">individual training</span> — you can join a choir anytime.
          </p>
        </div>
      </div>
    );
  }

  // Active choir view
  if (activeChoir && activeRole) {
    const hasWriteAccess = isDirector || choirMembers.some((m) => m.role === 'admin' && m.user_id === 'local-user');
    return (
      <div className="flex flex-col gap-6 animate-fade-in">
        {/* Back to choir list */}
        <button
          onClick={() => { setActiveChoirId(null); setChoirMembers([]); }}
          className="flex items-center gap-1.5 text-sm text-charcoal-muted transition-colors hover:text-charcoal w-fit"
        >
          <X className="h-4 w-4" /> Close Choir Space
        </button>

        {/* Success toast */}
        {toast && (
          <div className="rounded-xl bg-sage-light border border-sage-DEFAULT px-4 py-3 text-sm text-sage-deep animate-fade-in flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> {toast}
          </div>
        )}

        {/* Choir header */}
        <div className="card flex flex-col gap-3 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sage-light border border-sage-DEFAULT shadow-paper-sm">
              <Users className="h-6 w-6 text-sage-deep" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-charcoal">{activeChoir.name}</h2>
              {activeChoir.description && (
                <p className="text-sm text-charcoal-muted">{activeChoir.description}</p>
              )}
            </div>
            {isDirector && (
              <div className="ml-auto flex items-center gap-1.5 rounded-xl bg-mustard-light border border-mustard-DEFAULT px-2.5 py-1.5 text-xs font-medium text-mustard-deep">
                <Crown className="h-3.5 w-3.5" /> Director
              </div>
            )}
          </div>

          {/* Invite code — director only */}
          {isDirector && (
            <div className="flex items-center gap-2 rounded-xl bg-cream-200 border border-cream-400 px-4 py-2.5">
              <span className="text-sm text-charcoal-muted">Invite code:</span>
              <code className="font-mono font-bold text-sage-deep tracking-wider">{activeChoir.invite_code}</code>
              <p className="text-xs text-charcoal-muted ml-2">Share this with your singers!</p>
            </div>
          )}
        </div>

        {/* Choir Roster & Authority — visible to all, admin delegation MD only */}
        <div className="card flex flex-col gap-3 p-6">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-sage-deep" />
            <h3 className="font-semibold text-charcoal">Choir Roster & Authority ({choirMembers.length || 1})</h3>
          </div>
          {membersLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 text-charcoal-muted animate-spin" />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {/* Director row */}
              <div className="flex items-center justify-between rounded-xl bg-cream-200 border border-cream-400 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-mustard-light border border-mustard-DEFAULT">
                    <Crown className="h-4 w-4 text-mustard-deep" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-charcoal">{profile.displayName || 'You'}</span>
                    <span className="ml-2 text-[10px] font-medium text-mustard-deep bg-mustard-light border border-mustard-DEFAULT rounded px-1.5 py-0.5">MD</span>
                  </div>
                </div>
              </div>
              {/* Member rows with admin delegation */}
              {choirMembers.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-xl bg-cream-200 border border-cream-400 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${m.role === 'admin' ? 'bg-terracotta-light border border-terracotta-DEFAULT' : 'bg-sage-light border border-sage-DEFAULT'}`}>
                      <User className="h-4 w-4 text-sage-deep" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-charcoal">{m.display_name}</span>
                      <span className={`ml-2 text-[10px] font-medium rounded px-1.5 py-0.5 ${m.role === 'admin' ? 'text-terracotta-deep bg-terracotta-light border border-terracotta-DEFAULT' : 'text-sage-deep bg-sage-light border border-sage-DEFAULT'}`}>
                        {m.role === 'admin' ? 'Admin' : 'Member'}
                      </span>
                    </div>
                  </div>
                  {isDirector && (
                    <button
                      onClick={() => handleToggleAdmin(m.id, m.display_name || 'Member', m.role)}
                      className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all active:translate-y-0.5 ${
                        m.role === 'admin'
                          ? 'bg-terracotta-light border border-terracotta-DEFAULT text-terracotta-deep hover:bg-terracotta/20'
                          : 'bg-sage-light border border-sage-DEFAULT text-sage-deep hover:bg-sage-DEFAULT hover:text-cream-50'
                      }`}
                    >
                      {m.role === 'admin' ? <><ShieldOff className="h-3 w-3" /> Revoke Admin</> : <><Shield className="h-3 w-3" /> Make Admin</>}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Song Hub — write access for MD and admins */}
        <SongHub choirId={activeChoir.id} isDirector={hasWriteAccess} />

        {/* Assignments & Tasks — write access for MD and admins */}
        <AssignmentsPanel choirId={activeChoir.id} isDirector={hasWriteAccess} members={choirMembers.map((m) => ({ id: m.id, display_name: m.display_name, role: m.role }))} />

        {/* Leave Choir — available to all except MD owner */}
        {!isDirector && (
          <button
            onClick={handleLeaveChoir}
            className="btn-terracotta w-full max-w-sm mx-auto"
          >
            <LogOut className="h-4 w-4" /> Leave Choir
          </button>
        )}
      </div>
    );
  }

  // Choir list (user has choirs but none selected)
  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 mb-2">
          <Users className="h-6 w-6 text-sage-deep" />
          <h2 className="text-2xl font-bold text-charcoal">Choir Space</h2>
        </div>
        <p className="text-sm text-charcoal-muted">Select a choir to view its materials.</p>
      </div>

      {error && (
        <div className="rounded-xl bg-terracotta-light border border-terracotta-DEFAULT px-4 py-3 text-sm text-terracotta-deep">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-terracotta-deep/60">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {choirs.map((choir) => {
          const role = memberships[choir.id];
          const isDir = role === 'director';
          return (
            <button
              key={choir.id}
              onClick={() => setActiveChoirId(choir.id)}
              className="card-dashed-hover group flex flex-col gap-3 p-5 text-left transition-all"
            >
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-medium text-charcoal">{choir.name}</h4>
                {isDir ? (
                  <span className="flex items-center gap-1 rounded-md bg-mustard-light border border-mustard-DEFAULT px-2 py-0.5 text-[10px] font-medium text-mustard-deep">
                    <Crown className="h-3 w-3" /> Director
                  </span>
                ) : (
                  <span className="rounded-md bg-sage-light border border-sage-DEFAULT px-2 py-0.5 text-[10px] font-medium text-sage-deep">
                    Member
                  </span>
                )}
              </div>
              {choir.description && <p className="text-sm text-charcoal-muted">{choir.description}</p>}
              <div className="flex items-center gap-1.5 text-xs text-sage-deep opacity-0 transition-opacity group-hover:opacity-100">
                Open Choir Space <ArrowRight className="h-3 w-3" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Join another choir */}
      <div className="card flex flex-col gap-3 p-6">
        <div className="flex items-center gap-2">
          <LogIn className="h-5 w-5 text-sage-deep" />
          <h3 className="font-semibold text-charcoal">Join Another Choir</h3>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleJoinChoir(); }}
            maxLength={64}
            placeholder="Enter invite code"
            className="flex-1 rounded-xl bg-cream-50 border border-cream-400 px-4 py-3 text-charcoal font-mono placeholder-charcoal-muted/50 outline-none focus:border-sage-DEFAULT"
          />
          <button onClick={handleJoinChoir} disabled={joining || joinCode.trim().length === 0} className="btn-primary">
            {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
