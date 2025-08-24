'use client';
import '@/lib/amplify-client';
import { useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { apiBase } from '@/lib/aws';

export default function InvitePlayer() {
	const [status, setStatus] = useState<string>('');

	async function doInvite(formData: FormData) {
		setStatus('Sending invite...');
		try {
			const session = await fetchAuthSession();
			const idToken = session.tokens?.idToken?.toString();
			if (!idToken) { setStatus('Not signed in'); return; }
			const campaignId = String(formData.get('campaignId') || '').trim();
			const email = String(formData.get('email') || '').trim();
			if (!campaignId || !email) { setStatus('Campaign ID and email required'); return; }
			const res = await fetch(`/api/proxy/v1/campaigns/${encodeURIComponent(campaignId)}/invites`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
				body: JSON.stringify({ email }),
				cache: 'no-store',
			});
			const txt = await res.text();
			if (!res.ok) { setStatus(`Failed: ${res.status} ${txt}`); return; }
			setStatus('Invite queued');
		} catch (err) {
			setStatus(err instanceof Error ? err.message : 'failed');
		}
	}

	return (
		<div>
			<h2 className="text-lg font-medium mb-2">Invite Player</h2>
			<form className="grid gap-3" action={doInvite}>
				<input className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2" name="campaignId" placeholder="Campaign ID" required />
				<input className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2" name="email" placeholder="player@example.com" type="email" required />
				<button className="bg-amber-600 hover:bg-amber-500 rounded px-4 py-2 w-max" type="submit">Send Invite</button>
			</form>
			{status && <p className="text-sm opacity-80 mt-2">{status}</p>}
		</div>
	);
}


