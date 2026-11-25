import { authClient } from '@/lib/auth';
import { configured } from '@/lib/env';

export async function GET(req: Request) {
  if (configured()) await (await authClient()).auth.signOut();
  return Response.redirect(new URL('/login', req.url), 303);
}
