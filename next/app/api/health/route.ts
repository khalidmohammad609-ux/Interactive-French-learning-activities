import { store } from '@/lib/store';

/** Pinged every 3 days by .github/workflows/keep-alive.yml so the free Supabase project is not paused. */
export async function GET() {
  try {
    await store().ping();
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error(e);
    return Response.json({ ok: false }, { status: 503 });
  }
}
