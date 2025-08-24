'use client';
import '@/lib/amplify-client';
import { useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { apiBase } from '@/lib/aws';

type Session = { id: string; title: string; scheduled_at: string; duration_minutes?: number; status?: string };

export default function Sessions() {
	const [status, setStatus] = useState<string>('');
	const [items, setItems] = useState<Session[] | null>(null);

	async function load(formData: FormData) {
		setStatus('Loading sessions...');
		setItems(null);
		try {
			const session = await fetchAuthSession();
			const idToken = session.tokens?.idToken?.toString();
			if (!idToken) { setStatus('Not signed in'); return; }
			const campaignId = String(formData.get('campaignId') || '').trim();
			if (!campaignId) { setStatus('Campaign ID required'); return; }
			const res = await fetch(`/api/proxy/v1/campaigns/${encodeURIComponent(campaignId)}/sessions`, {
				headers: { Authorization: `Bearer ${idToken}` },
				cache: 'no-store',
			});
			const txt = await res.text();
			if (!res.ok) { setStatus(`Failed: ${res.status} ${txt}`); return; }
			setItems(JSON.parse(txt).items || []);
			setStatus('Loaded');
		} catch (err) {
			setStatus(err instanceof Error ? err.message : 'failed');
		}
	}

	async function create(formData: FormData) {
		setStatus('Creating session...');
		try {
			const session = await fetchAuthSession();
			const idToken = session.tokens?.idToken?.toString();
			if (!idToken) { setStatus('Not signed in'); return; }
			const campaignId = String(formData.get('campaignId') || '').trim();
			const title = String(formData.get('title') || '').trim();
			const when = String(formData.get('when') || '').trim();
			const duration = Number(String(formData.get('duration') || '').trim() || '180');
			if (!campaignId || !title || !when) { setStatus('Campaign ID, title, and date/time are required'); return; }
			const res = await fetch(`/api/proxy/v1/campaigns/${encodeURIComponent(campaignId)}/sessions`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
				body: JSON.stringify({ title, scheduled_at: when, duration_minutes: duration }),
				cache: 'no-store',
			});
			const txt = await res.text();
			if (!res.ok) { setStatus(`Failed: ${res.status} ${txt}`); return; }
			setStatus('Created');
		} catch (err) {
			setStatus(err instanceof Error ? err.message : 'failed');
		}
	}

	return (
		<div>
			<h2 className="text-lg font-medium mb-2">Sessions</h2>
			<form className="flex gap-2 mb-3" action={load}>
				<input className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2" name="campaignId" placeholder="Campaign ID" required />
				<button className="bg-neutral-700 hover:bg-neutral-600 rounded px-3 py-2" type="submit">Load</button>
			</form>
			<form className="grid gap-2 md:grid-cols-4 mb-3" action={create}>
				<input className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2" name="campaignId" placeholder="Campaign ID" required />
				<input className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2" name="title" placeholder="Title" required />
				<input className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2" name="when" type="datetime-local" required />
				<input className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2" name="duration" type="number" min="15" step="15" defaultValue={180} />
				<button className="bg-emerald-600 hover:bg-emerald-500 rounded px-3 py-2 md:col-span-4 w-max" type="submit">Create session</button>
			</form>
			{status && <p className="text-sm opacity-80 mb-2">{status}</p>}
			{items && (
				<ul className="space-y-2">
					{items.map(s => (
						<li key={s.id} className="border border-neutral-800 rounded p-3">
							<div className="font-medium">{s.title}</div>
							<div className="text-xs opacity-70">{new Date(s.scheduled_at).toLocaleString()} • {s.duration_minutes ?? 180} min</div>
							{s.status && <div className="text-xs opacity-60 mt-1">{s.status}</div>}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}


