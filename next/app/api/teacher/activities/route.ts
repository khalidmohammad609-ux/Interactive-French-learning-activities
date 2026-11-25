import { json, readJson } from '@/lib/api';
import { teacherOnly } from '@/lib/auth';
import { activities, addActivity, teacherAct, type NewActivity } from '@/lib/activities';

export async function GET() {
  return (await teacherOnly()) || json(async () => (await activities(true)).map(teacherAct));
}

export async function POST(req: Request) {
  return (await teacherOnly()) || json(async () => {
    const b = (await readJson(req, 4_000_000)) as { meta?: NewActivity; html?: string } | null;
    if (!b) throw new Error('Bad request.');
    return (await addActivity(b.meta || {}, String(b.html || ''))).map(teacherAct);
  });
}
