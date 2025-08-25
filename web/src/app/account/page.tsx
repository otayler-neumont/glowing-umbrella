"use client";
import "@/lib/amplify-client";
import { useEffect, useState } from "react";
import { getCurrentUser, fetchAuthSession, signOut } from "aws-amplify/auth";
import { useRouter } from "next/navigation";

type AccountInfo = { user: unknown; hasIdToken: boolean };

export default function AccountPage() {
    const [info, setInfo] = useState<AccountInfo | null>(null);
    const [status, setStatus] = useState<string>("");
    const router = useRouter();

    useEffect(() => {
        (async () => {
            try {
                const user = await getCurrentUser();
                const session = await fetchAuthSession();
                setInfo({ user, hasIdToken: Boolean(session.tokens?.idToken) });
            } catch {
                setInfo(null);
            }
        })();
    }, []);

    async function doSignOut() {
        setStatus("Signing out...");
        try {
            await signOut();
            setStatus("Signed out.");
            router.replace("/auth");
        } catch (err) {
            setStatus(err instanceof Error ? err.message : "failed");
        }
    }

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-semibold">Account</h1>
            {!info && <p className="opacity-80">You are not signed in.</p>}
            {info && (
                <pre className="bg-neutral-900 border border-neutral-800 rounded p-3 overflow-auto text-sm">{JSON.stringify(info, null, 2)}</pre>
            )}
            <div className="flex gap-3">
                <button onClick={doSignOut} className="bg-neutral-700 hover:bg-neutral-600 rounded px-4 py-2">Sign out</button>
            </div>
            {status && <p className="text-sm opacity-80">{status}</p>}
        </div>
    );
}
