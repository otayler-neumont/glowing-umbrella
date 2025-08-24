import { apiBase } from '@/lib/aws';
import ClientCampaigns from './sections/client-campaigns';
import CreateCampaign from './sections/create-campaign';
import InvitePlayer from './sections/invite-player';
import Sessions from './sections/sessions';
import CharacterSection from './sections/character';

async function fetchPing() {
    const res = await fetch(`${apiBase}/v1/ping`, { cache: 'no-store' });
    if (!res.ok) return { ok: false } as { ok: boolean; message?: string };
    return res.json();
}

export default async function DashboardPage() {
    const ping = await fetchPing();
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold">Dashboard</h1>
                <p className="opacity-75 text-sm mt-1">Quick actions and your recent data.</p>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
                <div className="border border-neutral-800 rounded p-4">
                    <h2 className="text-lg font-medium mb-2">Health</h2>
                    <pre className="bg-neutral-900 border border-neutral-800 rounded p-3 overflow-auto text-sm">{JSON.stringify(ping, null, 2)}</pre>
                </div>
                <div className="border border-neutral-800 rounded p-4">
                    <CreateCampaign />
                </div>
                <div className="border border-neutral-800 rounded p-4 md:col-span-2">
                    <ClientCampaigns />
                </div>
                <div className="border border-neutral-800 rounded p-4">
                    <InvitePlayer />
                </div>
                <div className="border border-neutral-800 rounded p-4">
                    <Sessions />
                </div>
                <div className="border border-neutral-800 rounded p-4 md:col-span-2">
                    <CharacterSection />
                </div>
            </div>
        </div>
    );
}
