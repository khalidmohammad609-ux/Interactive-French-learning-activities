import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/** Calls the real route handlers. First as a stranger (Supabase settings present, no login), then in LOCAL_MODE. */

const req = (path: string, init?: RequestInit) => new Request('https://app.test' + path, init);
const post = (path: string, body: unknown, method = 'POST') =>
  req(path, { method, headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '7.7.7.7' }, body: JSON.stringify(body) });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe('teacher routes are closed without login', () => {
  beforeAll(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'pk');
    vi.stubEnv('SUPABASE_SECRET_KEY', 'sk');
    vi.stubEnv('TEACHER_EMAIL', 'teacher@example.com');
    vi.resetModules();
    // No request context: the cookie reader throws, so no one is signed in.
    vi.doMock('next/headers', () => ({ cookies: async () => { throw new Error('no request'); } }));
  });
  afterAll(() => { vi.unstubAllEnvs(); vi.doUnmock('next/headers'); vi.resetModules(); });

  it('every /api/teacher route answers 401, /teacher redirects to /login', async () => {
    const r1 = await (await import('@/app/api/teacher/results/route')).GET();
    expect(r1.status).toBe(401);
    const acts = await import('@/app/api/teacher/activities/route');
    expect((await acts.GET()).status).toBe(401);
    expect((await acts.POST(post('/api/teacher/activities', { meta: {}, html: '<html>' }))).status).toBe(401);
    expect((await (await import('@/app/api/teacher/activities/[id]/route')).PATCH(post('/x', { hidden: true }, 'PATCH'), params('imparfait'))).status).toBe(401);
    expect((await (await import('@/app/api/teacher/activities/[id]/source/route')).GET(req('/x'), params('imparfait'))).status).toBe(401);
    const exp = await (await import('@/app/api/teacher/export/route')).GET(req('/api/teacher/export'));
    expect(exp.status).toBe(303);
    expect(exp.headers.get('location')).toBe('https://app.test/login');
    const t = await (await import('@/app/teacher/route')).GET(req('/teacher'));
    expect(t.status).toBe(303);
    expect(t.headers.get('location')).toBe('https://app.test/login');
  });
});

describe('LOCAL_MODE: whole flow through the routes', () => {
  beforeAll(() => { vi.stubEnv('LOCAL_MODE', '1'); vi.resetModules(); });
  afterAll(() => { vi.unstubAllEnvs(); vi.resetModules(); });
  beforeEach(async () => { (await import('@/lib/store')).setStore((await import('@/lib/store-memory')).memoryStore()); });

  it('student page, old ?a= link, activity page, 404', async () => {
    const home = await import('@/app/route');
    const h = await home.GET(req('/'));
    expect(h.status).toBe(200);
    expect(h.headers.get('content-type')).toContain('text/html');
    const old = await home.GET(req('/?a=imparfait'));
    expect(old.status).toBe(307);
    expect(old.headers.get('location')).toBe('https://app.test/a/imparfait');
    const page = await import('@/app/a/[id]/route');
    expect((await page.GET(req('/a/imparfait'), params('imparfait'))).status).toBe(200);
    expect((await page.GET(req('/a/nope'), params('nope'))).status).toBe(404);
  });

  it('result saved by a student shows on the master page and in the CSV', async () => {
    const save = await (await import('@/app/api/results/route')).POST(post('/api/results', { id: 'je-te-presente', name: 'Tawonga', score: 9, total: 10 }));
    expect(await save.json()).toEqual({ ok: true });
    const res = await (await import('@/app/api/teacher/results/route')).GET();
    const { data } = await res.json();
    expect(data[0]).toMatchObject({ name: 'Tawonga', activity: 'Je te présente…', pct: 90 });
    const csv = await (await (await import('@/app/api/teacher/export/route')).GET(req('/api/teacher/export'))).text();
    expect(csv).toContain('Tawonga');
  });

  it('bad requests to /api/results', async () => {
    const { POST } = await import('@/app/api/results/route');
    expect((await POST(req('/api/results', { method: 'POST', body: 'not json' }))).status).toBe(400);
    expect((await POST(req('/api/results', { method: 'POST', body: 'x'.repeat(30000) }))).status).toBe(413);
    expect((await POST(post('/api/results', { id: 'nope' }))).status).toBe(404);
  });

  it('add, edit, read source through the teacher routes', async () => {
    const acts = await import('@/app/api/teacher/activities/route');
    const html = '<!DOCTYPE html><html><body><div>Test page long enough to pass</div></body></html>';
    const added = await (await acts.POST(post('/api/teacher/activities', { meta: { title: 'Mon test', emoji: '🧪' }, html }))).json();
    const a = added.data.find((x: { id: string }) => x.id === 'mon-test');
    expect(a).toMatchObject({ source: 'drive', emoji: '🧪' });
    const patched = await (await (await import('@/app/api/teacher/activities/[id]/route')).PATCH(post('/x', { title: 'Renamed' }, 'PATCH'), params('mon-test'))).json();
    expect(patched.data.find((x: { id: string }) => x.id === 'mon-test').title).toBe('Renamed');
    const src = await (await (await import('@/app/api/teacher/activities/[id]/source/route')).GET(req('/x'), params('mon-test'))).json();
    expect(src.data).toBe(html);
    const bad = await acts.POST(post('/api/teacher/activities', { meta: {}, html: 'nope' }));
    expect(bad.status).toBe(500);
    expect((await bad.json()).error).toMatch(/HTML/);
  });

  it('health check', async () => {
    expect((await (await import('@/app/api/health/route')).GET()).status).toBe(200);
  });
});
