'use client';
import '@/lib/amplify-client';
import { useEffect, useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { apiBase } from '@/lib/aws';

export type Campaign = { id: string; name: string; description?: string | null; status?: string };

export default function ClientCampaigns() {
    const [items, setItems] = useState<Campaign[] | null>(null);
    const [error, setError] = useState<string>('');
    const [busyId, setBusyId] = useState<string>('');

    useEffect(() => {
        (async () => {
            try {
                const session = await fetchAuthSession();
                const idToken = session.tokens?.idToken?.toString();
                if (!idToken) { setError('Not signed in'); return; }
                const res = await fetch(`/api/proxy/v1/campaigns`, {
                    headers: { Authorization: `Bearer ${idToken}` },
                    cache: 'no-store'
                });
                if (!res.ok) { const t = await res.text(); setError(`Request failed: ${res.status} ${t}`); return; }
                const data = await res.json();
                setItems(data.items || []);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'failed');
            }
        })();
    }, []);

    const onDelete = async (id: string) => {
        try {
            setBusyId(id);
            const session = await fetchAuthSession();
            const idToken = session.tokens?.idToken?.toString();
            if (!idToken) { setError('Not signed in'); return; }
            const res = await fetch(`/api/proxy/v1/campaigns/${encodeURIComponent(id)}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${idToken}` },
            });
            if (!res.ok) { const t = await res.text(); setError(`Delete failed: ${res.status} ${t}`); return; }
            setItems((prev) => (prev ? prev.filter(c => c.id !== id) : prev));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'failed');
        } finally {
            setBusyId('');
        }
    };

    return (
        <div>
            <h2 className="text-lg font-medium mb-2">My Campaigns</h2>
            {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
            {!items && !error && <p className="opacity-70 text-sm">Sign in to load campaigns.</p>}
            {items && (
                <ul className="space-y-2">
                    {items.map(c => (
                        <li key={c.id} className="border border-neutral-800 rounded p-3">
                            <div className="font-semibold flex items-center justify-between">
                                <span>{c.name}</span>
                                <div className="flex items-center gap-2">
                                    <button
                                        className="text-xs px-2 py-1 border border-neutral-700 rounded hover:bg-neutral-800"
                                        onClick={() => navigator.clipboard.writeText(c.id)}
                                        title="Copy campaign ID"
                                    >Copy ID</button>
                                    <button
                                        className="text-xs px-2 py-1 border border-red-700 text-red-300 rounded hover:bg-red-900/30 disabled:opacity-50"
                                        onClick={() => onDelete(c.id)}
                                        disabled={busyId === c.id}
                                        title="Delete campaign"
                                    >{busyId === c.id ? 'Deleting…' : 'Delete'}</button>
                                </div>
                            </div>
                            {c.description && <div className="opacity-80 text-sm">{c.description}</div>}
                            {c.status && <div className="opacity-60 text-xs mt-1">{c.status}</div>}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
