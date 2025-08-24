import { apiBase } from '@/lib/aws';
import ClientCampaigns from './sections/client-campaigns';
import CreateCampaign from './sections/create-campaign';
import InvitePlayer from './sections/invite-player';
import Sessions from './sections/sessions';
import CharacterSection from './sections/character';

type PingResponse = { ok: boolean; message?: string };

async function fetchPing(): Promise<PingResponse> {
    const res = await fetch(`${apiBase}/v1/ping`, { cache: 'no-store' });
    if (!res.ok) return { ok: false } as PingResponse;
    return res.json();
}

export default async function DashboardPage() {
    const ping = await fetchPing();
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-semibold">Dashboard</h1>
            <div>
                <h2 className="text-lg font-medium mb-2">Health</h2>
                <pre className="bg-neutral-900 border border-neutral-800 rounded p-3 overflow-auto text-sm">{JSON.stringify(ping, null, 2)}</pre>
            </div>
            <ClientCampaigns />
            <CreateCampaign />
            <InvitePlayer />
            <Sessions />
            <CharacterSection />
        </div>
    );
}
