'use client';
import '@/lib/amplify-client';
import { useEffect, useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { apiBase } from '@/lib/aws';

type Campaign = { id: string; name: string; description?: string | null; status?: string };

export default function ClientCampaigns() {
    const [items, setItems] = useState<Campaign[] | null>(null);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        (async () => {
            try {
                const session = await fetchAuthSession();
                const idToken = session.tokens?.idToken?.toString();
                if (!idToken) { setError('Not signed in'); return; }
                const res = await fetch(`${apiBase}/v1/campaigns`, {
                    headers: { Authorization: idToken },
                    cache: 'no-store'
                });
                if (!res.ok) { setError(`Request failed: ${res.status}`); return; }
                const data = await res.json();
                setItems(data.items || []);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'failed');
            }
        })();
    }, []);

    return (
        <div>
            <h2 className="text-lg font-medium mb-2">My Campaigns</h2>
            {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
            {!items && !error && <p className="opacity-70 text-sm">Sign in to load campaigns.</p>}
            {items && (
                <ul className="space-y-2">
                    {items.map(c => (
                        <li key={c.id} className="border border-neutral-800 rounded p-3">
                            <div className="font-semibold">{c.name}</div>
                            {c.description && <div className="opacity-80 text-sm">{c.description}</div>}
                            {c.status && <div className="opacity-60 text-xs mt-1">{c.status}</div>}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
