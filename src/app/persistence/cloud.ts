// Optional cloud save (Supabase). Enabled only when VITE_SUPABASE_URL and
// VITE_SUPABASE_ANON_KEY are set at build time; otherwise the app is fully
// local-first and the Account menu is hidden. The client library is loaded
// lazily so it never weighs on the first load. Schema: supabase/schema.sql.

import type { Doc } from '../../engine/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DocSummary } from './library';

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const cloudEnabled = Boolean(URL_ && KEY);

let client: Promise<SupabaseClient> | null = null;
function sb(): Promise<SupabaseClient> {
  if (!cloudEnabled) return Promise.reject(new Error('Cloud sync is not configured'));
  if (!client) client = import('@supabase/supabase-js').then((m) => m.createClient(URL_!, KEY!));
  return client;
}

export interface CloudUser {
  id: string;
  email: string | null;
}

export async function currentUser(): Promise<CloudUser | null> {
  if (!cloudEnabled) return null;
  const { data } = await (await sb()).auth.getUser();
  return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
}

export async function onAuthChange(cb: (u: CloudUser | null) => void): Promise<() => void> {
  if (!cloudEnabled) return () => {};
  const { data } = (await sb()).auth.onAuthStateChange((_e, session) => {
    cb(session?.user ? { id: session.user.id, email: session.user.email ?? null } : null);
  });
  return () => data.subscription.unsubscribe();
}

export async function signInWithGoogle(): Promise<void> {
  const { error } = await (await sb()).auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
  if (error) throw error;
}

export async function signInWithEmail(email: string): Promise<void> {
  const { error } = await (await sb()).auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await (await sb()).auth.signOut();
}

export async function saveCloud(doc: Doc, userId: string): Promise<void> {
  const { error } = await (await sb())
    .from('constructions')
    .upsert({ id: doc.id, owner: userId, title: doc.title, doc, updated_at: new Date(doc.updatedAt).toISOString() });
  if (error) throw error;
}

export async function listCloud(): Promise<DocSummary[]> {
  const { data, error } = await (await sb()).from('constructions').select('id, title, updated_at, doc').order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: { id: string; title: string; updated_at: string; doc: Doc }) => ({
    id: r.id,
    title: r.title,
    updatedAt: Date.parse(r.updated_at),
    objectCount: r.doc?.order?.length ?? 0,
    stepCount: r.doc?.steps?.length ?? 0,
  }));
}

export async function loadCloud(id: string): Promise<Doc | null> {
  const { data, error } = await (await sb()).from('constructions').select('doc').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data?.doc as Doc) ?? null;
}

export async function deleteCloud(id: string): Promise<void> {
  const { error } = await (await sb()).from('constructions').delete().eq('id', id);
  if (error) throw error;
}
