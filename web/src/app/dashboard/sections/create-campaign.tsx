'use client';
import '@/lib/amplify-client';
import { useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { apiBase } from '@/lib/aws';

export default function CreateCampaign() {
	const [status, setStatus] = useState<string>('');
	const [createdId, setCreatedId] = useState<string>('');

	async function doCreate(formData: FormData) {
		setStatus('Creating campaign...');
		setCreatedId('');
		try {
			const session = await fetchAuthSession();
			const idToken = session.tokens?.idToken?.toString();
			if (!idToken) { setStatus('Not signed in'); return; }
			const body = {
				name: String(formData.get('name') || '').trim(),
				description: String(formData.get('description') || '').trim() || undefined,
			};
			if (!body.name) { setStatus('Name is required'); return; }
			const res = await fetch(`${apiBase}/v1/campaigns`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: idToken },
				body: JSON.stringify(body),
				cache: 'no-store',
			});
			const txt = await res.text();
			if (!res.ok) { setStatus(`Failed: ${res.status} ${txt}`); return; }
			const data = JSON.parse(txt);
			setCreatedId(data.id);
			setStatus('Created');
		} catch (err) {
			setStatus(err instanceof Error ? err.message : 'failed');
		}
	}

	return (
		<div>
			<h2 className="text-lg font-medium mb-2">Create Campaign</h2>
			<form className="grid gap-3" action={doCreate}>
				<input className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2" name="name" placeholder="Name" required />
				<input className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2" name="description" placeholder="Description (optional)" />
				<button className="bg-indigo-600 hover:bg-indigo-500 rounded px-4 py-2 w-max" type="submit">Create</button>
			</form>
			{status && <p className="text-sm opacity-80 mt-2">{status}{createdId && ` (id: ${createdId})`}</p>}
		</div>
	);
}


