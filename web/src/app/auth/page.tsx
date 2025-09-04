'use client';
import '@/lib/amplify-client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { signUp, signIn, getCurrentUser, fetchAuthSession, confirmSignUp } from 'aws-amplify/auth';
import { useRouter, useSearchParams } from 'next/navigation';

function AuthPageInner() {
    const [status, setStatus] = useState<string>('');
    const [tab, setTab] = useState<'signin' | 'signup' | 'confirm'>('signin');
    const router = useRouter();
    const searchParams = useSearchParams();
    const nextPath = useMemo(() => {
        const n = searchParams.get('next');
        if (!n) return '/dashboard';
        try {
            // Only allow path starts to avoid open redirect
            const url = new URL(n, 'http://local');
            return url.pathname + url.search + url.hash;
        } catch {
            return '/dashboard';
        }
    }, [searchParams]);

    function getErrorMessage(err: unknown): string {
        if (err instanceof Error) {
            return err.message;
        }
        if (typeof err === 'string') {
            return err;
        }
        if (err && typeof err === 'object' && 'name' in err) {
            return String((err as { name?: string }).name);
        }
        return 'An error occurred';
    }


    useEffect(() => {
        (async () => {
            try {
                const session = await fetchAuthSession();
                if (session.tokens?.idToken) {
                    setStatus('You are signed in.');
                }
            } catch { }
        })();
    }, []);

    async function doSignup(formData: FormData) {
        const email = String(formData.get('email') || '');
        const password = String(formData.get('password') || '');
        setStatus('Signing up...');
        try {
            await signUp({ username: email, password, options: { userAttributes: { email } } });
            setStatus('Sign up complete. Enter the verification code sent to your email.');
            setTab('confirm');
        } catch (err) {
            setStatus(getErrorMessage(err));
        }
    }
    async function doSignin(formData: FormData) {
        const email = String(formData.get('email') || '');
        const password = String(formData.get('password') || '');
        setStatus('Signing in...');
        try {
            await signIn({ username: email, password });
            await getCurrentUser();
            const session = await fetchAuthSession();
            if (session.tokens?.idToken) {
                setStatus('Signed in. Redirecting...');
                router.replace(nextPath || '/dashboard');
                return;
            }
            setStatus('Signed in, but session missing token.');
        } catch (err) {
            setStatus(getErrorMessage(err));
        }
    }
    async function doConfirm(formData: FormData) {
        const email = String(formData.get('email') || '');
        const code = String(formData.get('code') || '');
        if (!email || !code) { setStatus('Email and code are required.'); return; }
        setStatus('Confirming account...');
        try {
            await confirmSignUp({ username: email, confirmationCode: code });
            setStatus('Account confirmed. Please sign in.');
            setTab('signin');
        } catch (err) {
            setStatus(getErrorMessage(err));
        }
    }

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-semibold">Account</h1>
            <div className="flex gap-2">
                <button className={`px-3 py-1 rounded border ${tab === 'signin' ? 'bg-neutral-800' : ''}`} onClick={() => setTab('signin')}>Sign in</button>
                <button className={`px-3 py-1 rounded border ${tab === 'signup' ? 'bg-neutral-800' : ''}`} onClick={() => setTab('signup')}>Sign up</button>
                <button className={`px-3 py-1 rounded border ${tab === 'confirm' ? 'bg-neutral-800' : ''}`} onClick={() => setTab('confirm')}>Confirm</button>
            </div>

            {tab === 'signup' && (
                <section>
                    <form className="grid gap-3 max-w-sm" action={doSignup}>
                        <input className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2" name="email" placeholder="Email" type="email" required />
                        <input className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2" name="password" placeholder="Password" type="password" required autoComplete="new-password" />
                        <button className="bg-blue-600 hover:bg-blue-500 rounded px-4 py-2 w-max" type="submit">Create account</button>
                    </form>
                    <p className="text-xs opacity-60 mt-2">You’ll receive a verification code to confirm your account.</p>
                </section>
            )}

            {tab === 'signin' && (
                <section>
                    <form className="grid gap-3 max-w-sm" action={doSignin}>
                        <input className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2" name="email" placeholder="Email" type="email" required />
                        <input className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2" name="password" placeholder="Password" type="password" required />
                        <button className="bg-emerald-600 hover:bg-emerald-500 rounded px-4 py-2 w-max" type="submit">Sign in</button>
                    </form>
                </section>
            )}

            {tab === 'confirm' && (
                <section>
                    <form className="grid gap-3 max-w-sm" action={doConfirm}>
                        <input className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2" name="email" placeholder="Email" type="email" required />
                        <input className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2" name="code" placeholder="Verification code" type="text" required />
                        <button className="bg-purple-600 hover:bg-purple-500 rounded px-4 py-2 w-max" type="submit">Confirm account</button>
                    </form>
                </section>
            )}

            {status && <p className="text-sm opacity-80">{status}</p>}
        </div>
    );
}

export default function AuthPage() {
    return (
        <Suspense fallback={<div className="opacity-80">Loading...</div>}>
            <AuthPageInner />
        </Suspense>
    );
}
