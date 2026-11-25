import { teacherOnly } from '@/lib/auth';
import { resultsCsv } from '@/lib/results';

/** « Export results (CSV) »: the free Supabase plan has no automatic backups, so keep a copy now and then. */
export async function GET(req: Request) {
  const deny = await teacherOnly();
  if (deny) return Response.redirect(new URL('/login', req.url), 303);
  const day = new Date().toISOString().slice(0, 10);
  return new Response(await resultsCsv(), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="french-activities-results-${day}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
