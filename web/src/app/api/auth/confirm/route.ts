import { NextResponse } from 'next/server';
import { doConfirm } from '../route-helpers';

export async function POST(req: Request){
  const form = await req.formData();
  const email = String(form.get('email')||'');
  const code = String(form.get('code')||'');
  if(!email || !code) return NextResponse.json({ error: 'email and code required' }, { status: 400 });
  try{
    await doConfirm(email, code);
    return NextResponse.redirect(new URL('/auth', req.url));
  }catch(err: unknown){
    const message = err instanceof Error ? err.message : 'confirm failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
