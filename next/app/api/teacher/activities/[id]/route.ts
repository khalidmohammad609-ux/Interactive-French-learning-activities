import { json, readJson } from '@/lib/api';
import { teacherOnly } from '@/lib/auth';
import { teacherAct, updateActivity } from '@/lib/activities';

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return (await teacherOnly()) || json(async () => {
    const { id } = await ctx.params;
    const patch = (await readJson(req, 20_000)) as Record<string, unknown> | null;
    if (!patch || typeof patch !== 'object') throw new Error('Bad request.');
    return (await updateActivity(id, patch)).map(teacherAct);
  });
}
