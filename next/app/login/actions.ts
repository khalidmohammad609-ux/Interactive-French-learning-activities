'use server';

import { redirect } from 'next/navigation';
import { authClient } from '@/lib/auth';
import { env, configured } from '@/lib/env';

export type LoginState = { step: 'email' | 'code'; email: string; message: string; error: boolean };

/** Step 1: email → a code is emailed. Step 2: code → signed in. */
export async function login(prev: LoginState, form: FormData): Promise<LoginState> {
  if (!configured()) return { ...prev, message: 'Sign-in is not set up yet (Supabase settings missing in Vercel).', error: true };
  const sb = await authClient();

  if (form.has('code')) {
    const token = String(form.get('code') || '').replace(/\s/g, '');
    if (!/^\d{6,10}$/.test(token)) return { ...prev, message: 'The code is the number in the email.', error: true };
    const { error } = await sb.auth.verifyOtp({ email: prev.email, token, type: 'email' });
    if (error) return { ...prev, message: 'That code did not work: ' + error.message, error: true };
    redirect('/teacher');
  }

  const email = String(form.get('email') || '').trim().toLowerCase();
  if (!email.includes('@')) return { step: 'email', email, message: 'Please type your email address.', error: true };
  // Only the teacher's email can sign in; nothing is sent to any other address.
  if (email !== env.teacherEmail) return { step: 'email', email, message: 'This email is not allowed on the master page.', error: true };
  const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) return { step: 'email', email, message: 'Could not send the email: ' + error.message, error: true };
  return { step: 'code', email, message: 'Check your email: type the code here, or tap the link in it.', error: false };
}
