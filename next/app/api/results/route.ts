import { clientIp, readJson } from '@/lib/api';
import { saveResult } from '@/lib/results';

/** Public: saves one finished level (called by web/bridge.js through the google.script.run adapter). */
export async function POST(req: Request) {
  try {
    const body = await readJson(req, 20_000);
    const out = await saveResult(body, clientIp(req));
    return Response.json(out.body, { status: out.status });
  } catch (e) {
    const status = (e as { status?: number }).status || 500;
    if (status === 500) console.error(e);
    return Response.json({ ok: false, error: status === 413 ? 'too big' : 'server error' }, { status });
  }
}
