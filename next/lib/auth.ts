import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { env, configured } from './env';

/** Supabase Auth client bound to the request cookies (server only). Cookies are httpOnly: no script can read them. */
export async function authClient() {
  const jar = await cookies();
  return createServerClient(env.supabaseUrl, env.supabasePublicKey, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => jar.set(name, value, { ...options, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' }));
        } catch { /* called while rendering: ignore, the next request refreshes */ }
      },
    },
  });
}

export async function isTeacher(): Promise<boolean> {
  if (!configured()) return env.localMode;
  try {
    const { data } = await (await authClient()).auth.getUser();
    const email = data.user?.email?.toLowerCase();
    return !!email && email === env.teacherEmail;
  } catch {
    return false;
  }
}

/** For /api/teacher/* routes: null when allowed, otherwise a 401 response. */
export async function teacherOnly(): Promise<Response | null> {
  return (await isTeacher()) ? null : Response.json({ error: 'Please sign in.' }, { status: 401 });
}
