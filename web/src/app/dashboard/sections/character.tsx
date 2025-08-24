'use client';
import '@/lib/amplify-client';
import { useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { apiBase } from '@/lib/aws';

type Character = { id: string; name: string; class: string; level: number };

export default function CharacterSection() {
	const [status, setStatus] = useState<string>('');
	const [character, setCharacter] = useState<Character | null>(null);

	async function load(formData: FormData) {
		setStatus('Loading character...');
		try {
			const session = await fetchAuthSession();
			const idToken = session.tokens?.idToken?.toString();
			if (!idToken) { setStatus('Not signed in'); return; }
			const campaignId = String(formData.get('campaignId') || '').trim();
			if (!campaignId) { setStatus('Campaign ID required'); return; }
			const url = `/api/proxy/v1/characters/me?campaign_id=${encodeURIComponent(campaignId)}`;
			const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` }, cache: 'no-store' });
			const txt = await res.text();
			if (!res.ok) { setStatus(`Failed: ${res.status} ${txt}`); setCharacter(null); return; }
			setCharacter(JSON.parse(txt));
			setStatus('Loaded');
		} catch (err) {
			setStatus(err instanceof Error ? err.message : 'failed');
		}
	}

	async function save(formData: FormData) {
		setStatus('Saving character...');
		try {
			const session = await fetchAuthSession();
			const idToken = session.tokens?.idToken?.toString();
			if (!idToken) { setStatus('Not signed in'); return; }
			const body = {
				campaign_id: String(formData.get('campaignId') || '').trim(),
				name: String(formData.get('name') || '').trim(),
				class: String(formData.get('class') || '').trim(),
				level: Number(String(formData.get('level') || '').trim() || '1'),
			};
			if (!body.campaign_id || !body.name || !body.class) { setStatus('Campaign ID, name, class required'); return; }
			const res = await fetch(`/api/proxy/v1/characters/me`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
				body: JSON.stringify(body),
				cache: 'no-store',
			});
			const txt = await res.text();
			if (!res.ok) { setStatus(`Failed: ${res.status} ${txt}`); return; }
			setStatus('Saved');
		} catch (err) {
			setStatus(err instanceof Error ? err.message : 'failed');
		}
	}

	return (
		<div>
			<h2 className="text-lg font-medium mb-2">Character</h2>
			<form className="flex gap-2 mb-3" action={load}>
				<input className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2" name="campaignId" placeholder="Campaign ID" required />
				<button className="bg-neutral-700 hover:bg-neutral-600 rounded px-3 py-2" type="submit">Load</button>
			</form>
			<form className="grid gap-2 md:grid-cols-4" action={save}>
				<input className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2" name="campaignId" placeholder="Campaign ID" required />
				<input className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2" name="name" placeholder="Name" required />
				<input className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2" name="class" placeholder="Class" required />
				<input className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2" name="level" type="number" min={1} defaultValue={1} />
				<button className="bg-sky-600 hover:bg-sky-500 rounded px-3 py-2 md:col-span-4 w-max" type="submit">Save</button>
			</form>
			{status && <p className="text-sm opacity-80 mt-2">{status}</p>}
			{character && (
				<pre className="bg-neutral-900 border border-neutral-800 rounded p-3 overflow-auto text-sm mt-2">{JSON.stringify(character, null, 2)}</pre>
			)}
		</div>
	);
}


