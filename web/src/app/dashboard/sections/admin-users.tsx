'use client';
import '@/lib/amplify-client';
import { useEffect, useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';

type AdminUser = {
  username?: string;
  status?: string;
  enabled?: boolean;
  attributes?: Array<{ Name?: string; Value?: string }>;
};

export default function AdminUsers() {
  const [items, setItems] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string>('');
  const [notAdmin, setNotAdmin] = useState<boolean>(false);
  const [busy, setBusy] = useState<string>('');

  async function load() {
    try {
      setError('');
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      if (!idToken) { setError('Not signed in'); return; }
      const res = await fetch('/api/proxy/v1/admin/users', { headers: { Authorization: `Bearer ${idToken}` }, cache: 'no-store' });
      if (res.status === 403) { setNotAdmin(true); return; }
      if (!res.ok) { const t = await res.text(); setError(`Failed: ${res.status} ${t}`); return; }
      const data = await res.json();
      setItems(data.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed');
    }
  }

  useEffect(() => { load(); }, []);

  async function remove(username: string) {
    try {
      setBusy(username);
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      if (!idToken) { setError('Not signed in'); return; }
      const res = await fetch(`/api/proxy/v1/admin/users/${encodeURIComponent(username)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
        cache: 'no-store',
      });
      const txt = await res.text();
      if (!res.ok) { setError(`Delete failed: ${res.status} ${txt}`); return; }
      setItems(prev => prev ? prev.filter(u => u.username !== username) : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed');
    } finally {
      setBusy('');
    }
  }

  if (notAdmin) return null; // hide section for non-admins

  return (
    <div className="border border-neutral-800 rounded p-4 md:col-span-2">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-medium">Admin • Users</h2>
        <button className="text-xs px-2 py-1 border border-neutral-700 rounded hover:bg-neutral-800" onClick={load}>Refresh</button>
      </div>
      {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
      {!items && !error && <p className="opacity-70 text-sm">Loading users…</p>}
      {items && (
        <ul className="space-y-2">
          {items.map(u => (
            <li key={u.username} className="border border-neutral-800 rounded p-3 flex items-center justify-between">
              <div className="text-sm">
                <div className="font-medium">{u.username}</div>
                <div className="opacity-70">
                  {(u.attributes || []).find(a => a.Name === 'email')?.Value || ''}
                </div>
              </div>
              <button
                className="text-xs px-2 py-1 border border-red-700 text-red-300 rounded hover:bg-red-900/30 disabled:opacity-50"
                onClick={() => remove(u.username || '')}
                disabled={busy === u.username}
                title="Delete user"
              >{busy === u.username ? 'Deleting…' : 'Delete'}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


