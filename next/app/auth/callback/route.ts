import type { EmailOtpType } from '@supabase/supabase-js';
import { authClient } from '@/lib/auth';

/** The link in the sign-in email lands here. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = (url.searchParams.get('type') || 'email') as EmailOtpType;
  const sb = await authClient();
  const { error } = code
    ? await sb.auth.exchangeCodeForSession(code)
    : tokenHash
      ? await sb.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error('missing code') };
  return Response.redirect(new URL(error ? '/login?failed=1' : '/teacher', url), 303);
}
