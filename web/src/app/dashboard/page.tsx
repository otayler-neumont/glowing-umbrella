import { apiBase } from '@/lib/aws';
import ClientCampaigns from './sections/client-campaigns';
import CreateCampaign from './sections/create-campaign';
import InvitePlayer from './sections/invite-player';
import Sessions from './sections/sessions';
import CharacterSection from './sections/character';
import AdminUsers from './sections/admin-users';

async function fetchPing() {
    try {
        if (!apiBase) {
            return { ok: false, message: 'Not signed in' } as { ok: boolean; message?: string };
        }
        const res = await fetch(`${apiBase}/v1/ping`, { cache: 'no-store' });
        if (res.status === 401 || res.status === 403) {
            return { ok: false, message: 'Not signed in' } as { ok: boolean; message?: string };
        }
        if (!res.ok) return { ok: false, message: `HTTP ${res.status}` } as { ok: boolean; message?: string };
        return res.json();
    } catch {
        return { ok: false, message: 'Not signed in' } as { ok: boolean; message?: string };
    }
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
                    {(!ping || (ping as { ok?: boolean }).ok === false) ? (
                        <p className="text-sm opacity-80">Not signed in.</p>
                    ) : (
                        <pre className="bg-neutral-900 border border-neutral-800 rounded p-3 overflow-auto text-sm">{JSON.stringify(ping, null, 2)}</pre>
                    )}
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
                <AdminUsers />
            </div>
        </div>
    );
}
