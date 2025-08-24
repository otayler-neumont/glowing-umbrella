import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { doSignin } from '../route-helpers';

export async function POST(req: Request){
  const form = await req.formData();
  const email = String(form.get('email')||'');
  const password = String(form.get('password')||'');
  if(!email || !password) return NextResponse.json({ error: 'email and password required' }, { status: 400 });
  try{
    await doSignin(email, password);
    // Amplify returns tokens via getCurrentSession; for simplicity, keep username in cookie
    const cookieStore = await cookies();
    cookieStore.set('amplify_username', email, { httpOnly: true, sameSite: 'lax', path: '/' });
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }catch(err: unknown){
    const message = err instanceof Error ? err.message : 'signin failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
