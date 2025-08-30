"use client";
import '@/lib/amplify-client';
import { useEffect, useRef, useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { useRouter, useSearchParams } from 'next/navigation';

export default function AcceptInvitePage() {
    const [status, setStatus] = useState<string>("");
    const router = useRouter();
    const searchParams = useSearchParams();
    const attempted = useRef(false);

    useEffect(() => {
        const token = searchParams.get('token');
        if (!token || attempted.current) return;
        attempted.current = true;
        (async () => {
            try {
                const session = await fetchAuthSession();
                const idToken = session.tokens?.idToken?.toString();
                if (!idToken) {
                    setStatus('Redirecting to sign in...');
                    const next = `/accept?token=${encodeURIComponent(token)}`;
                    router.replace(`/auth?next=${encodeURIComponent(next)}`);
                    return;
                }
                setStatus('Accepting invite...');
                const res = await fetch(`/api/proxy/v1/invites/${encodeURIComponent(token)}/accept`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${idToken}` }
                });
                const text = await res.text();
                if (!res.ok) { setStatus(`Failed: ${res.status} ${text}`); return; }
                setStatus(`Success: ${text}`);
            } catch (err) {
                setStatus(err instanceof Error ? err.message : 'failed');
            }
        })();
    }, [searchParams, router]);

    async function onSubmit(formData: FormData) {
        setStatus('Accepting invite...');
        const token = String(formData.get('token') || '').trim();
        if (!token) { setStatus('Token is required'); return; }
        try {
            const session = await fetchAuthSession();
            const idToken = session.tokens?.idToken?.toString();
            const res = await fetch(`/api/proxy/v1/invites/${encodeURIComponent(token)}/accept`, {
                method: 'POST',
                headers: { ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) }
            });
            const text = await res.text();
            if (!res.ok) { setStatus(`Failed: ${res.status} ${text}`); return; }
            setStatus(`Success: ${text}`);
        } catch (err) {
            setStatus(err instanceof Error ? err.message : 'failed');
        }
    }

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-semibold">Accept Invite</h1>
            <form className="grid gap-3 max-w-md" action={onSubmit}>
                <input className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2" name="token" placeholder="Paste invitation token" defaultValue={searchParams.get('token') || ''} />
                <button className="bg-emerald-600 hover:bg-emerald-500 rounded px-4 py-2 w-max" type="submit">Accept</button>
            </form>
            {status && <pre className="bg-neutral-900 border border-neutral-800 rounded p-3 overflow-auto text-sm">{status}</pre>}
        </div>
    );
}
