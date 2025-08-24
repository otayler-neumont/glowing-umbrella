'use client';
import '@/lib/amplify-client';
import { useState } from 'react';
import { signUp, confirmSignUp, signIn, getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';

export default function AuthPage() {
    const [status, setStatus] = useState<string>('');

    async function doSignup(formData: FormData) {
        const email = String(formData.get('email') || '');
        const password = String(formData.get('password') || '');
        setStatus('Signing up...');
        await signUp({ username: email, password, options: { userAttributes: { email } } });
        setStatus('Sign up complete. Check email for code, then confirm.');
    }
    async function doConfirm(formData: FormData) {
        const email = String(formData.get('email') || '');
        const code = String(formData.get('code') || '');
        setStatus('Confirming...');
        await confirmSignUp({ username: email, confirmationCode: code });
        setStatus('Confirmed. You can sign in now.');
    }
    async function doSignin(formData: FormData) {
        const email = String(formData.get('email') || '');
        const password = String(formData.get('password') || '');
        setStatus('Signing in...');
        await signIn({ username: email, password });
        const user = await getCurrentUser();
        const session = await fetchAuthSession();
        setStatus(`Signed in as ${user.username}. Has ID token: ${Boolean(session.tokens?.idToken)}`);
    }

    return (
        <div className="grid md:grid-cols-2 gap-8">
            <section>
                <h1 className="text-2xl font-semibold mb-4">Sign up</h1>
                <form className="grid gap-3" action={doSignup}>
                    <input className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2" name="email" placeholder="Email" type="email" required />
                    <input className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2" name="password" placeholder="Password" type="password" required />
                    <button className="bg-blue-600 hover:bg-blue-500 rounded px-4 py-2 w-max" type="submit">Create account</button>
                </form>
                <p className="text-xs opacity-60 mt-2">After sign up, check email for code and confirm below.</p>
            </section>
            <section>
                <h2 className="text-2xl font-semibold mb-4">Sign in</h2>
                <form className="grid gap-3" action={doSignin}>
                    <input className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2" name="email" placeholder="Email" type="email" required />
                    <input className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2" name="password" placeholder="Password" type="password" required />
                    <button className="bg-emerald-600 hover:bg-emerald-500 rounded px-4 py-2 w-max" type="submit">Sign in</button>
                </form>
                <h3 className="text-lg font-semibold mt-8 mb-2">Confirm sign up</h3>
                <form className="grid gap-3" action={doConfirm}>
                    <input className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2" name="email" placeholder="Email" type="email" required />
                    <input className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2" name="code" placeholder="Code" type="text" required />
                    <button className="bg-purple-600 hover:bg-purple-500 rounded px-4 py-2 w-max" type="submit">Confirm</button>
                </form>
            </section>
            <div className="md:col-span-2 mt-4"><pre className="text-xs opacity-80">{status}</pre></div>
        </div>
    );
}
