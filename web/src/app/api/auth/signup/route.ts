import { NextResponse } from 'next/server';
import { doSignup } from '../route-helpers';

export async function POST(req: Request){
  const form = await req.formData();
  const email = String(form.get('email')||'');
  const password = String(form.get('password')||'');
  if(!email || !password) return NextResponse.json({ error: 'email and password required' }, { status: 400 });
  try{
    await doSignup(email, password);
    return NextResponse.redirect(new URL('/auth', req.url));
  }catch(err: unknown){
    const message = err instanceof Error ? err.message : 'signup failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
