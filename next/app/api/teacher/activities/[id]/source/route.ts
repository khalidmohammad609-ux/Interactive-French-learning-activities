import { json } from '@/lib/api';
import { teacherOnly } from '@/lib/auth';
import { activitySource, findActivity } from '@/lib/activities';

/** The HTML of an activity, for ⬆️ Upgrade and 🎬 Videos on the master page. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return (await teacherOnly()) || json(async () => {
    const { id } = await ctx.params;
    const a = await findActivity(id, true);
    if (!a) throw new Error('Activity not found.');
    return activitySource(a);
  });
}
